// TypeScript Version: 3.0

import * as contentful from 'contentful';

export interface RouteConfig {
  url?: string;
  changefreg?: string;
  lastmod?: string;
  id?: string;
  pattern?: string;
  priority?: number;
  params?: object;
  query?: object;
}

export interface RoutesInterface {
  [index: number]: RouteConfig;
}

export interface OptionsInterface {
  locales?: string[];
  dynamicLocales?: boolean;
  dynamicLastmod?: boolean;
  localeParam?: string;
  defaultLocale?: string;
}

export class ContentfulSitemap {
  route: RouteConfig;
  routes: RoutesInterface;
  options: OptionsInterface;

  constructor(
    client: contentful.ContentfulClientApi,
    routes?: RoutesInterface,
    options?: OptionsInterface
  );

  addRoute(route: RouteConfig): ContentfulSitemap;

  loadLocales(): Promise<any>;

  loadEntry(): Promise<any>;

  loadEntries(): Promise<any>;

  buildLocaleLinks(toPath: () => void, params: object): RouteConfig[];

  filterEntry(entry: object, route: RouteConfig, params: object): boolean;

  buildEntryParams(entry: object, route: RouteConfig, params: object): RouteConfig;

  handleQueryRoute(route: RouteConfig, toPath: () => void, params: object): Promise<RouteConfig>;

  parseRoutes(): Array<Promise<any>>;

  buildRoutes(): Promise<any[]>;

  toXML(callback: () => {}): void;
}
