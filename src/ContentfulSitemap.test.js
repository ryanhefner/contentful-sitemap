import * as contentful from 'contentful';
import { ContentfulSitemap } from './index';

describe('ContentfulSitemap', () => {
  let client;

  beforeAll(() => {
    client = contentful.createClient({
      space: 'space-is-great',
      accessToken: '12345',
    });
  });

  test('class initializes', () => {
    const error = jest.spyOn(global.console, 'error');
    const sitemap = new ContentfulSitemap(client);

    expect(error).not.toBeCalled();
  });

  test('error thrown when no client passed', () => {
    const t = () => {
      try {
        const sitemap = new ContentfulSitemap();
      }
      catch (e) {
        throw new TypeError();
      }
    };

    expect(t).toThrow(TypeError);
  });

  test('error thrown when invalid client supplied', () => {
    const t = () => {
      try {
        const sitemap = new ContentfulSitemap({});
      }
      catch (e) {
        throw new TypeError();
      }
    };

    expect(t).toThrow(TypeError);
  });

  test.skip('addRoute', () => {});
  test.skip('loadLocales', () => {});
  test.skip('loadEntry', () => {});
  test.skip('loadEntries', () => {});
  test.skip('buildLocaleLinks', () => {});
  test.skip('filterEntry', () => {});
  test.skip('buildEntryParams', () => {});
  test.skip('handleQueryRoute', () => {});
  test.skip('parseRoutes', () => {});
  test.skip('toXML', () => {});
});
