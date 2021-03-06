import {
  ASSESSMENT_RECORDER_URL,
  BASE_STRIGO_URL,
  CDN_BASE_PATH,
  INIT_SCRIPT_ID,
  LOCAL_STRIGO_URL,
} from '../../strigo/consts';
import { StrigoConfig, SiteConfig } from '../config/config.types';
import { WidgetFlavors } from '../widgets/widget.types';

import { InitScriptParams } from './url.types';

const STRIGO_CHILD_IFRAME_PARAM = 'strigoChildIframe';

function paramsToObject(entries: IterableIterator<[string, string]>): Record<string, string> {
  const result = {};

  for (const [key, value] of entries) {
    // each 'entry' is a [key, value] tupple
    result[key] = value;
  }

  return result;
}

export function extractUrlParams(search: string): Record<string, string> {
  // TODO: Add polyfill for older browsers
  const urlParams = new URLSearchParams(search);
  const entries = urlParams.entries();

  return paramsToObject(entries);
}

export function getUrlData(): SiteConfig {
  const { host, pathname, href, origin, search } = window.location;

  return {
    host,
    pathName: pathname,
    href,
    origin,
    search,
    params: extractUrlParams(search),
  };
}

export function generateStrigoIframeURL(config: StrigoConfig): string {
  const { subDomain, user, webApiKey } = config;

  return window.Strigo.isDevelopment()
    ? `${LOCAL_STRIGO_URL}/academy/courses?token=${user.token.token}&webApiKey=${webApiKey}`
    : `https://${subDomain}.${BASE_STRIGO_URL}/academy/courses?token=${user.token.token}&webApiKey=${webApiKey}`;
}

export function generateStrigoChildIframeURL(url: string): string {
  const currentUrl = new URL(url);

  currentUrl.searchParams.set(STRIGO_CHILD_IFRAME_PARAM, 'true');

  return currentUrl.toString();
}

export function isStrigoChildIframe(): boolean {
  return window.location.search.includes(STRIGO_CHILD_IFRAME_PARAM);
}

export function removeStrigoChildIframeParam(): void {
  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);
  searchParams.delete(STRIGO_CHILD_IFRAME_PARAM);
  url.search = searchParams.toString();
  window.history.replaceState(window.history.state, '', url);
}

export function extractInitScriptParams(): InitScriptParams {
  const initScript = document.getElementById(INIT_SCRIPT_ID);

  return {
    webApiKey: initScript?.getAttribute('data-web-api-key') || '',
    subDomain: initScript?.getAttribute('data-subdomain') || '',
    selectedWidgetFlavor: (initScript?.getAttribute('data-layout-flavor') as WidgetFlavors) || WidgetFlavors.DYNAMIC,
  };
}

export function generateCssURL(version?: string): string {
  if (window.Strigo.isDevelopment()) {
    return `${SDK_LOCAL_URL}/styles/strigo.css`;
  }

  if (version) {
    return `${CDN_BASE_PATH}@${version}/dist/production/styles/strigo.min.css`;
  }

  return `${CDN_BASE_PATH}@master/dist/production/styles/strigo.min.css`;
}

export function generateWidgetCssURL(version?: string): string {
  if (window.Strigo.isDevelopment()) {
    return `${SDK_LOCAL_URL}/styles/strigo-widget.css`;
  }

  if (version) {
    return `${CDN_BASE_PATH}@${version}/dist/production/styles/strigo-widget.min.css`;
  }

  return `${CDN_BASE_PATH}@master/dist/production/styles/strigo-widget.min.css`;
}

export function generateAcademyHatCssURL(version?: string): string {
  if (window.Strigo.isDevelopment()) {
    return `${SDK_LOCAL_URL}/styles/strigo-academy-hat.css`;
  }

  if (version) {
    return `${CDN_BASE_PATH}@${version}/dist/production/styles/strigo-academy-hat.min.css`;
  }

  return `${CDN_BASE_PATH}@master/dist/production/styles/strigo-academy-hat.min.css`;
}

export function generateRecorderCssURL(version?: string): string {
  if (window.Strigo.isDevelopment()) {
    return `${SDK_LOCAL_URL}/styles/strigo-assessment-recorder.css`;
  }

  if (version) {
    return `${CDN_BASE_PATH}@${version}/dist/production/styles/strigo-assessment-recorder.min.css`;
  }

  return `${CDN_BASE_PATH}@master/dist/production/styles/strigo-assessment-recorder.min.css`;
}

export function generateAssessmentRecorderURL(): string {
  return window.Strigo.isDevelopment() ? RECORDER_LOCAL_URL : ASSESSMENT_RECORDER_URL;
}

export function isRecordingUrlParamExists(): boolean {
  const { search } = window.location;
  const urlParams = extractUrlParams(search);

  return 'strigoAssessmentRecorder' in urlParams;
}
