import { app } from "./app.js";
import {
  constructServerLayout,
  sendLayoutHTTPResponse,
} from "single-spa-layout/server";
import _ from "lodash";
import { getImportMaps } from "single-spa-web-server-utils";

const serverLayout = constructServerLayout({
  filePath: "server/views/index.html",
});

app.use("*", (req, res, next) => {
  const importMapsPromise = getImportMaps({
    url:
      "https://storage.googleapis.com/isomorphic.microfrontends.app/importmap.json",
    nodeKeyFilter(importMapKey) {
      return importMapKey.startsWith("@isomorphic-mf");
    },
    req,
    allowOverrides: true,
  }).then(({ nodeImportMap, browserImportMap }) => {
    global.nodeLoader.setImportMapPromise(Promise.resolve(nodeImportMap));
    return { nodeImportMap, browserImportMap };
  });

  const importSuffix =
    process.env.NODE_ENV === "development" ? `?ts=${Date.now()}` : "";

  const props = {
    user: {
      id: 1,
      name: "Test User",
    },
  };

  sendLayoutHTTPResponse({
    serverLayout,
    urlPath: req.path,
    res,

    async renderFragment(name) {
      const { browserImportMap } = await importMapsPromise;
      return `<script type="systemjs-importmap">${JSON.stringify(
        browserImportMap,
        null,
        2
      )}</script>`;
    },
    async renderApplication({ appName, propsPromise }) {
      await importMapsPromise;
      const [app, props] = await Promise.all([
        import(appName + `/server.mjs${importSuffix}`),
        propsPromise,
      ]);
      return app.serverRender(props);
    },
    async retrieveApplicationHeaders({ appName, propsPromise }) {
      await importMapsPromise;
      const [app, props] = await Promise.all([
        import(appName + `/server.mjs${importSuffix}`),
        propsPromise,
      ]);
      return app.getResponseHeaders(props);
    },
    async retrieveProp(propName) {
      return props[propName];
    },
    assembleFinalHeaders(allHeaders) {
      return Object.assign({}, Object.values(allHeaders));
    },
  })
    .then(next)
    .catch((err) => {
      console.error(err);
      res.status(500).send("A server error occurred");
    });
});
