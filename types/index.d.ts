// TypeScript Version: 3.0

import { ContentfulClientApi } from 'contentful';

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
  origin?: string;
  localeParam?: string;
  defaultLocale?: string;
}

export class ContentfulSitemap {
  constructor(routes: RoutesInterface, client: ContentfulClientApi, options: OptionsInterface);

  addRoute(route: RouteConfig): ContentfulSitemap;

  loadLocales(): Promise<any>;

  loadEntry(): Promise<any>;

  loadEntries(): Promise<any>;

  buildLocaleLinks(toPath: () => {}, params: object): RouteConfig[];

  filterEntry(entry: object, route: RouteConfig, params: object): boolean;

  buildEntryParams(entry: object, route: RouteConfig, params: object): RouteConfig;

  handleQueryRoute(route: RouteConfig, toPath: () => {}, params: object): Promise<RouteConfig>;

  parseRoutes(): Array<Promise<any>>;

  toXML(callback: () => {}): Promise<any>;
}
