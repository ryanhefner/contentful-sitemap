# 🗺 contentful-sitemap

[![npm](https://img.shields.io/npm/v/contentful-sitemap?style=flat-square)](https://www.pkgstats.com/pkg:contentful-sitemap)
[![NPM](https://img.shields.io/npm/l/contentful-sitemap?style=flat-square)](LICENSE)
[![npm](https://img.shields.io/npm/dt/contentful-sitemap?style=flat-square)](https://www.pkgstats.com/pkg:contentful-sitemap)
[![Coveralls github](https://img.shields.io/coveralls/github/ryanhefner/contentful-sitemap?style=flat-square)](https://coveralls.io/github/ryanhefner/contentful-sitemap)
[![CircleCI](https://img.shields.io/circleci/build/github/ryanhefner/contentful-sitemap?style=flat-square)](https://circleci.com/gh/ryanhefner/contentful-sitemap)
![Snyk Vulnerabilities for GitHub Repo](https://img.shields.io/snyk/vulnerabilities/github/ryanhefner/contentful-sitemap?style=flat-square)

Dynamically generate an array of valid `sitemap` routes to enable building a live sitemap based on Contentful content via the Contentful API.

## Install

Via [npm](https://npmjs.com/package/contentful-sitemap)

```sh
npm install contentful-sitemap
```

Via [Yarn](http://yarn.fyi/contentful-sitemap)

```sh
yarn add contentful-sitemap
```


## How to use

`contentful-sitemap` requires a Contentful client in order to fetch entries from
your Contenful space in order to build your dynamic sitemap entries. So, make sure
you have `contentful` as a dependency in your project.

__Install `contentful`__

```sh
npm i -S contentful
```

__Create Contentful client__

```js
const contentful = require('contentful');
const { ContentfulSitemap } = require('contentful-sitemap');

const client = contentful.createClient({
  accessToken: '[ACCESS_TOKEN]',
  space: '[SPACE_ID]',
});
```

Next comes setting up the `ContentfulSitemap` instance that will be used by your
`/sitemap.xml` route to generate and return the sitemap. `ContentfulSitemap` requires
a `client` instance, so make sure you pass one into the constructor.

__Create `ContentfulSitemap` instance__

```js
const sitemapGenerator = new ContentfulSitemap(client, [routes], {options});
```

### Parameters

* `client` - Contentful client that will be used for fetching locales and entries from Contentful.

* `routes` - Array of route definitions to use to generate sitemap.

* `options` - Options that you can use to customize how sitemaps are generated.


### Routes

`contentful-sitemap` generates a route array that is compatible with the
[`sitemap`](https://npmjs.com/package/sitemap) package for generating your
`sitemap.xml` file, so all `route` options supported by that package are
also supported within the `routes` array you pass in. You can pass in both
static and dynamic Contentful routes within the array. Below are the few
specifics that directly relate to how `contentful-sitemap` will process
your `routes` entries.

| Name              | Default             | Description                                                                                                                                                                 |
| ----------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`             | `null`              | Use this property if the path you are providing does not require any segments to be swapped out dynamically.                                                                |
| `id`              | `null`              | Contentful entry `id` to fetch for the specific path. Only used if the `dynamicLastmod` option is set to  `true`.                                                           |
| `pattern`         | `null`              | [`path-to-regexp`](https://npmjs.com/package/path-to-regexp) pattern to use for generating dynamic listings based on Contentful content or setting `locale` specific paths. |
| `priority`        | `1`                 | Default `priority` to set for each `url`. Set to `1` as a default so it can be excluded in your `routes` definitions.                                                       |
| `params`          | `null`              | Object used to specify the mapping of `pattern` parameter to Contentful response data.                                                                                      |
| `query`           | `null`              | Query used by the Contentful `client` for fetching entries. All [contentful](https://npmjs.com/package/contentful) `getEntries` query options are supported.                |


### Default Options

The following options can be used to customize the way your sitemap is generated.
The one option that you’ll definitely want to set, if not defined in your `routes`
is the `origin` option, which is prefixed before the `url`s and `pattern`s defined
in your routes.

| Name              | Default             | Description                                                                           |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------- |
| `locales`         | `[]`                | Array of locales to include for all route instances, if not using `dynamicLocales`.   |
| `dynamicLocales`  | `false`             | Whether or not to fetch the list of enabled `locales` from Contentful.                |
| `dynamicLastmod`  | `false`             | Automatically use the `lastmodParam` value of each entry to set the `lastmod` value.  |
| `lastmodParam`    | `sys.updatedAt`     | Contentful model field to use when populating `lastmodISO` in route(s).               |
| `localeParam`     | `locale`            | The param to set within your `pattern` to replace with a `locale`.                    |
| `defaultLocale`   | `null`              | The default locale that will be used in the main `loc` value for a `url`.             |


### Methods

* `addRoute(route)` - Method to use for adding additional urls after the initial `ContentfulSitemap` instance has been created.

* `buildRoutes()` - The magic✨ Call this method when you want to generate your Contentful routes to be passed to `sitemap`.

* `toXML((xml, err) => {})` - __*DEPRECATED*__ - This was the previous method that this class used to build and return the full `sitemap.xml` string, but due to changes made to the `sitemap` package it seemed like it would be easier to support the current—and future—versions of that package by simplifying this package to do one thing well, while offering more flexibility with how you would like to use `sitemap` to generate your sitemap(s).

## Example

```js
const express = require('express');
const contentful = require('contentful');
const { SitemapStream, streamToPromise } = require('sitemap');
const { createGzip } = require('zlib');
const { ContentfulSitemap } = require('contentful-sitemap');

const app = express();

const client = contentful.createClient({
  accessToken: '[ACCESS_TOKEN]',
  space: '[SPACE_ID]',
});

const sitemapGenerator = new ContentfulSitemap(client, [
  {
    pattern: '/',
    id: '[HOME_PAGE_ID]',
  },
  {
    pattern: '/about',
    id: '[ABOUT_PAGE_ID]',
    priority: 0.7,
  },
  {
    pattern: '/news',
    id: '[NEWS_PAGE_ID]',
  },
  {
    pattern: '/news/:slug',
    priority: 0.5,
    query: {
      content_type: '[CONTENTFUL_MODEL_TYPE (e.g. `newsArticlePage`)]',
      select: 'fields.slug',
    },
    params: {
      slug: 'fields.slug',
    },
  },
  {
    url: '/terms',
    priority: 0.3,
  },
  {
    url: '/privacy',
    priority: 0.3,
  }
]);

let sitemap;

app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  res.header('Content-Encoding', 'gzip');

  if (sitemap) {
    return res.send(sitemap);
  }

  try {
    const smStream = new SitemapStream({ hostname: 'https://example.com/' });
    const pipeline = smStream.pipe(createGzip());

    return sitemapGenerator.buildRoutes()
      .then(routes => {
        // pipe your entries or directly write them.
        routes.forEach(route => smStream.write(route));
        smStream.end()

        // cache the response
        streamToPromise(pipeline).then(sm => sitemap = sm)
        // stream write the response
        pipeline.pipe(res).on('error', (e) => {throw e})
      })
      .catch(error => {
        console.error(error);
        res.status(500).end();
      });
  } catch (e) {
    console.error(e)
    res.status(500).end()
  }
});

...

```


## License

[MIT](LICENSE) © [Ryan Hefner](https://www.ryanhefner.com)
