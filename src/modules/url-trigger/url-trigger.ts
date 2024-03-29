/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import debounce from 'lodash.debounce';

import { Logger } from '../../services/logger';
import * as sessionManager from '../session/session';
import { UrlTrigger, UrlTriggerMatchType } from '../config/config.types';
import { StorageNames, StorageTypes } from '../storage-utils/storage-utils.types';

const bodyObserverOptions = {
  subtree: true,
  childList: true,
};

let currentLocation;

export function setupUrlTriggers(urlTriggers: UrlTrigger[]): void {
  try {
    window[StorageTypes.LOCAL_STORAGE].setItem(StorageNames.STRIGO_URL_TRIGGERS, JSON.stringify(urlTriggers));
  } catch (error) {
    Logger.error('Url triggers setup error', { error });

    return null;
  }
}

export function getUrlTriggers(): UrlTrigger[] | undefined {
  try {
    const urlTriggersValue = window[StorageTypes.LOCAL_STORAGE].getItem(StorageNames.STRIGO_URL_TRIGGERS);

    if (urlTriggersValue) {
      return JSON.parse(urlTriggersValue) as UrlTrigger[];
    }
  } catch (error) {
    Logger.error('Get url triggers error', { error });

    return null;
  }
}

export function detectUrlTrigger(currentWindow: Window): void {
  const strigoIframe = document.getElementById('strigo-exercises') as HTMLIFrameElement;
  const currentHref = currentWindow.document.location.href;
  const urlTriggers: UrlTrigger[] = getUrlTriggers();

  if (!urlTriggers) {
    return;
  }

  const urlTriggeredCourses = (sessionManager.getSessionValue('urlTriggeredCourses') as string[]) || [];

  for (const urlTrigger of urlTriggers) {
    const { publishmentId, urlTriggerMatchType, urlTriggerUrl } = urlTrigger;

    Logger.info('Detect URL trigger invoked', { publishmentId, urlTriggeredCourses });

    if (!publishmentId) {
      Logger.info('URL trigger detected without course id');

      continue;
    }

    if (!urlTriggerUrl) {
      Logger.info('URL trigger detected without url');

      continue;
    }

    if (urlTriggeredCourses.includes(publishmentId)) {
      Logger.info('Detected URL trigger for a course that was already opened, doing nothing');

      continue;
    }

    switch (urlTriggerMatchType) {
      case UrlTriggerMatchType.EXACT: {
        if (urlTriggerUrl.trim() === currentHref.trim()) {
          strigoIframe.contentWindow.postMessage({ selectedCourseId: publishmentId }, '*');
        }

        break;
      }

      case UrlTriggerMatchType.STARTS_WITH: {
        if (currentHref.trim().startsWith(urlTriggerUrl.trim())) {
          strigoIframe.contentWindow.postMessage({ selectedCourseId: publishmentId }, '*');
        }

        break;
      }

      default:
        break;
    }
  }
}

const urlTriggerObserverHandler = function (pageMutations): void {
  const isAddedNodes = pageMutations.some((mutation) => mutation.addedNodes?.length > 0);

  Logger.info('#####', { isAddedNodes });

  if (!isAddedNodes) {
    Logger.info('*** No added nodes and no character data change were detected after url change.', {
      previousLocation: currentLocation || '',
      newLocation: document.location.href,
    });

    return;
  }

  if (currentLocation === document.location.href) {
    Logger.info('*** No URL change and no nodes were added.');
  } else {
    Logger.info('*** Detected URL change!', {
      previousLocation: currentLocation || '',
      newLocation: document.location.href,
    });

    // location changed!
    currentLocation = document.location.href;
  }

  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  initUrlTriggerObserver(window);
};

export const initUrlTriggerObserver = debounce((windowToObserve: Window): void => {
  Logger.info('*** Initializing url trigger observer');

  if (!windowToObserve?.strigoUrlTriggerObserver?.observer) {
    Logger.info('*** Adding Strigo url trigger observer to document body');

    windowToObserve.strigoUrlTriggerObserver = {
      observer: new MutationObserver(urlTriggerObserverHandler),
      observedBodyElement: windowToObserve.document.body,
    };

    detectUrlTrigger(windowToObserve);
    Logger.info('*** Starting to observe document body - url trigger observer');
    windowToObserve?.strigoUrlTriggerObserver?.observer?.observe(windowToObserve.document, bodyObserverOptions);

    return;
  }

  detectUrlTrigger(windowToObserve);

  if (!windowToObserve.document.contains(windowToObserve.strigoUrlTriggerObserver.observedBodyElement)) {
    Logger.info(
      '*** Detected a "body" element change. Re-initializing the document observer - url trigger observer...'
    );
    windowToObserve.strigoUrlTriggerObserver.observedBodyElement = windowToObserve.document.body;
    windowToObserve.strigoUrlTriggerObserver.observer.observe(windowToObserve.document, bodyObserverOptions);
  }
}, 500);
