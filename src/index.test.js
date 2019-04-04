import contentful from 'contentful';
import ContentfulSitemap from './index';

describe('<ContentfulSitemap />', () => {
  test('class initializes', () => {
    const error = jest.spyOn(global.console, 'error');
    const sitemap = new ContentfulSitemap([], {});

    expect(error).not.toBeCalled();
  });

  test('error thrown when no client passed', () => {
    const t = () => {
      try {
        const sitemap = new ContentfulSitemap([]);
      }
      catch (e) {
        throw new TypeError();
      }
    };

    expect(t).toThrow(TypeError);
  });
});
