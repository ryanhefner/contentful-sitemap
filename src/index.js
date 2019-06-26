const pathToRegexp = require('path-to-regexp');
const invariant = require('invariant');
const has = require('lodash.has');
const get = require('lodash.get');
const sitemap = require('sitemap');

/**
 * ContentfulSitemap Class
 * Accepts an array of routes, a Contentful client and a few options and can
 * spit out a beautiful sitemap that includes locale support.
 *
 * @param {Array} routes
 * @param {ContentfulClient} client
 * @param {Object} options
 * @return ContentfulSitemap
 */
class ContentfulSitemap {
  constructor(routes = [], client = null, options = {}) {
    invariant(client, 'Contentful client not provided to ContentfulSitemap');

    this.client = client;
    this.routes = routes.map(route => Object.assign({}, this.route, route));
    this.options = Object.assign({}, this.options, options);

    this.sitemap = sitemap.createSitemap({
      hostname: this.options.origin,
      cacheTime: 0,
      urls: [],
    });
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

    return true;
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
      select: `${route.query.select || ''}${this.options.dynamicLastmod ? ',sys.updatedAt' : ''}`
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
            route.lastmodISO = get(entry, 'sys.updatedAt');
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
          route.lastmodISO = get(entry, 'sys.updatedAt');
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
   * @param {function} callback
   * @return Promise
   */
  async toXML(callback) {
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

    // Resolve all the routes and generate the sitemap
    return Promise.all(routes)
      .then((routes) => {
        routes.reduce((acc, cur) => {
          return acc.concat(cur);
        }, [])
        .forEach(route => {
          this.sitemap.add(route);
        });

        return this.sitemap.toXML(callback);
      })
      .catch(error => {
        console.error(error);
      });
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
  localeParam: 'locale',
  defaultLocale: null,
};

module.exports = ContentfulSitemap;
