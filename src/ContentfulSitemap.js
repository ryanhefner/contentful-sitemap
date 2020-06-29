const pathToRegexp = require('path-to-regexp');
const invariant = require('invariant');
const has = require('lodash.has');
const get = require('lodash.get');
const { SitemapStream, streamToPromise } = require('sitemap');

/**
 * Validate client object matches expected shape of Contentful client.
 *
 * @param {Object} client
 * @return boolean
 */
const validClient = (client) => {
  if (!client.getEntries || typeof client.getEntries !== 'function') {
    return false;
  }

  if (!client.getEntry || typeof client.getEntry !== 'function') {
    return false;
  }

  if (!client.getLocales || typeof client.getLocales !== 'function') {
    return false;
  }

  return true;
}

/**
 * ContentfulSitemap Class
 * Accepts an array of routes, a Contentful client and a few options and can
 * spit out a beautiful sitemap that includes locale support.
 *
 * @param {ContentfulClient} client
 * @param {Array} routes
 * @param {Object} options
 * @return ContentfulSitemap
 */
export class ContentfulSitemap {
  constructor(client, routes = [], options = {}) {
    invariant(client, 'Contentful client not provided to ContentfulSitemap');
    invariant(validClient(client), '`client` is not a valid instance of `ContentfulClientApi`');

    this.client = client;
    this.routes = routes.map(route => Object.assign({}, this.route, route));
    this.options = Object.assign({}, this.options, options);
  }

  /**
   * Add a route
   *
   * @pararm {Object} route
   * @return ContentfulSitemap
   */
  addRoute(route) {
    this.routes = [
      ...this.routes,
      Object.assign({}, this.route, route),
    ];

    return this;
  }

  /**
   * Load locales from Contentful
   *
   * @return Promise
   */
  async loadLocales() {
    try {
      const locales = await this.client.getLocales();
      return Promise.resolve(locales);
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * Load Contentful entry.
   *
   * @param {string} id
   * @return Object
   */
  async loadEntry(id) {
    try {
      const entry = await this.client.getEntry(id);
      return Promise.resolve(entry);
    }
    catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * Load Contentful entries to build routes out of, recursively loading entries
   * until all entries for the query are loaded.
   *
   * @param {Object} query
   * @param {Number} skip
   * @param {Array} items
   * @return Promise
   */
  async loadEntries(query, skip = 0, items = []) {
    try {
      const entries = await this.client.getEntries(Object.assign({}, query, {
        skip,
      }));

      // If more entries exist, call this method again, incrementing skip value
      if ((entries.skip + entries.items.length) < entries.total) {
        return this.loadEntries(query, skip + entries.limit, [
          ...items,
          ...entries.items,
        ]);
      }

      return Promise.resolve(Object.assign({}, entries, {
        items: [
          ...items,
          ...entries.items,
        ],
      }));
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * Build an array of object for use with links entries for a route.
   *
   * @param {function} toPath
   * @param {Object} params
   * @return Array
   */
  buildLocaleLinks(toPath, params = {}) {
    return this.options.locales.map((locale) => {
      return {
        url: decodeURIComponent(toPath({ ...params, locale })),
        lang: locale,
      };
    });
  }

  /**
   * Check entry to make sure it fulfills being able to be converted to a route.
   *
   * @param {Object} entry
   * @param {Object} route
   * @param {Object} params
   * @return boolean
   */
  filterEntry(entry, route, params) {
    // Filter all non-objects or objects that are empty
    if (typeof entry !== 'object' || Object.keys(entry).length === 0) {
      return false;
    }

    // If the route has specified params, make sure those params are accessible on the entry
    if (route.params) {
      Object.keys(route.params).forEach((param) => {
        const paramPath = route.params[param];
        if (!has(entry, paramPath) || !get(entry, paramPath) || get(entry, paramPath) === undefined) {
          return false;
        }
      });
    }

    // Confirm that all params expected by the route pattern are supplied
    // via the params pulled from the entry
    const entryParams = this.buildEntryParams(entry, route, params);
    let tokensValid = true;

    if (route.params) {
      const tokens = pathToRegexp.parse(route.pattern);
      tokens.forEach(token => {
        if (typeof token === 'object' && token.name) {
          const tokenInvalid = !entryParams.hasOwnProperty(token.name)
            || !entryParams[token.name]
            || entryParams[token.name] === undefined;

          if (tokenInvalid) {
            tokensValid = false;
          }
        }
      });
    }

    return tokensValid;
  }

  /**
   * Build an object that contains all the params necessary for the route
   * based on the entry and params provided.
   *
   * @param {Object} entry
   * @param {Object} route
   * @param {Object} params
   * @return Object
   */
  buildEntryParams(entry, route, params) {
    const entryParams = Object.assign({}, params);

    if (route.params) {
      Object.keys(route.params).forEach((param) => {
        const paramPath = route.params[param];
        entryParams[param] = get(entry, paramPath);
      });
    }

    return entryParams;
  }

  /**
   * Handle loading entries for a route and resolve with an array of Promises for each entry.
   *
   * @param {Object} route
   * @param {function} toPath
   * @param {Object} params
   * @return Array
   */
  async handleQueryRoute(route, toPath, params = {}) {
    const query = Object.assign({}, route.query, {
      select: `${route.query.select || ''}${this.options.dynamicLastmod ? `,${this.options.lastmodParam}` : ''}`
    })

    try {
      const entries = await this.loadEntries(route.query);
      const routes = [];

      const hasEntries = entries
        && entries.items
        && entries.items.length
        && Array.isArray(entries.items);

      if (!hasEntries) {
        return Promise.resolve(routes);
      }

      entries.items.filter((entry) => typeof entry === 'object' && Object.keys(entry).length > 0)
        .filter((entry) => {
          return this.filterEntry(entry, route, params);
        })
        .forEach((entry) => {
          const entryParams = this.buildEntryParams(entry, route, params);

          if (this.options.dynamicLastmod) {
            route.lastmodISO = get(entry, this.options.lastmodParam);
          }

          if (this.options.dynamicLocales) {
            route.links = this.buildLocaleLinks(toPath, entryParams);
          }

          routes.push({
            ...route,
            url: decodeURIComponent(toPath(entryParams)),
          });
        });

      return Promise.resolve(routes);
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * Loop through routes, parsing them based on their properties.
   *
   * @return Array
   */
  async parseRoutes() {
    try {
      const routes = this.routes.map(async (route) => {
        if (route.id && this.options.dynamicLastmod) {
          const entry = await this.loadEntry(route.id);
          route.lastmodISO = get(entry, this.options.lastmodParam);
        }

        if (route.pattern) {
          const toPath = pathToRegexp.compile(route.pattern);
          const params = {};

          if (this.options.defaultLocale) {
            Object.assign(params, {
              [this.options.localeParam]: this.options.defaultLocale,
            });
          }

          if (route.query) {
            const queryRoutes = await this.handleQueryRoute(route, toPath, params);
            return queryRoutes;
          }

          try {
            if (this.options.dynamicLocales) {
              route.links = this.buildLocaleLinks(toPath, params);
            }

            return [{
              ...route,
              url: decodeURIComponent(toPath(params)),
            }];
          } catch (e) {
            // Skip the route if things do not lineup
            return null;
          }
        }

        return Promise.resolve([route]);
      })
      .filter(route => route !== null)
      .reduce((acc, cur) => {
        return acc.concat(cur);
      }, []);

      return Promise.resolve(routes);
    } catch (e) {
      console.error(e);
      return Promise.reject(e);
    }
  }

  /**
   * Parse routes to an XML file.
   *
   * @return Promise
   */
  async buildRoutes() {
    // If dynamicLocales set, load locales from Contentful and populate properties/defaults
    if (this.options.dynamicLocales) {
      const locales = await this.loadLocales();
      this.options.locales = locales.items.map((item) => {
        if (!this.options.defaultLocale && item.default) {
          this.options.defaultLocale = item.code;
        }

        return item.code;
      });
    }

    // Parse the routes array
    const routes = await this.parseRoutes();

    // Resolve and return all the routes for sitemap
    return Promise.all(routes)
      .then((routes) => {
        return routes.reduce((acc, cur) => {
          return acc.concat(cur);
        }, []);
      });
  }

  /**
   * !!!DEPRECATED!!! - Do not use.
   *
   * Calls callback with generated sitemap.xml file or error.
   *
   * @param {function} callback
   * @return void
   */
  toXML(callback) {
    this.buildRoutes()
      .then(routes => {
        const smStream = new SitemapStream({ hostname: this.options.origin });
        routes.forEach(route => smStream.write(route));
        smStream.end();

        streamToPromise(smStream).then(data => callback(data.toString(), null));
      })
      .catch(err => callback(null, err));
  }
}

ContentfulSitemap.prototype.routes = [];
ContentfulSitemap.prototype.route = {
  url: null,
  changefreq: null,
  lastmod: null,
  priority: 1,
  id: null,
  pattern: null,
  params: null,
  query: null,
};
ContentfulSitemap.prototype.options = {
  locales: [],
  dynamicLocales: false,
  dynamicLastmod: false,
  origin: '',
  lastmodParam: 'sys.updatedAt',
  localeParam: 'locale',
  defaultLocale: null,
};
