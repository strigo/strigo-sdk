import * as urlTools from '../modules/url/url';
import * as configManager from '../modules/config/config';
import * as sessionManager from '../modules/session/session';
import * as eventsStorageManager from '../modules/events-storage/events-storage';
import * as assessmentsStorage from '../modules/assessments-storage/assessments-storage';
import * as assessmentRecorderModule from '../modules/assessment-recorder/assessment-recorder';
import { Logger } from '../services/logger';
import * as widgetFactory from '../modules/widgets/widget-factory';
import { MessageTypes } from '../modules/listeners/listeners.types';
import { startElementSelector } from '../modules/element-selector/element-selector';
import { DockingSide } from '../modules/config/config.types';
import { shouldPanelBeOpen } from '../modules/session/session';

import { IStrigoSDK, SdkConfig, SDKSetupData, SdkTypes } from './types';

class StrigoSDK implements IStrigoSDK {
  config: SdkConfig = {};

  isDevelopment(): boolean {
    return IS_DEVELOPMENT === 'true';
  }

  init(): void {
    try {
      Logger.info('Initializing SDK...');

      if (this.config.initialized) {
        Logger.info('SDK was already initialized');

        return;
      }

      eventsStorageManager.initEventsStorage();
      assessmentsStorage.initAssessmentStorage();

      // Get init script parameters
      const { webApiKey, subDomain, selectedWidgetFlavor } = urlTools.extractInitScriptParams();

      if (!webApiKey || !subDomain || !selectedWidgetFlavor) {
        throw new Error('Init data is missing');
      }

      const widgetFlavor = widgetFactory.getWidgetFlavor(selectedWidgetFlavor);

      configManager.initLocalStorageConfig({ webApiKey, subDomain, selectedWidgetFlavor: widgetFlavor });

      const widget = widgetFactory.getWidget(widgetFlavor);
      this.config.sdkType = widget.init();
      this.config.initialized = true;

      Logger.info('Initialized SDK.');

      // Auto open academy if it was opened in this session before.
      if (this.config.sdkType !== SdkTypes.CHILD && sessionManager.shouldPanelBeOpen()) {
        this.setup();
      }
    } catch (err) {
      Logger.error('Could not initialize SDK', { err });
    }
  }

  async setup(data?: SDKSetupData): Promise<void> {
    try {
      Logger.info('Starting to setup SDK...');

      const strigoWidget = document.getElementById('strigo-widget');
      const isPanelOpen = this.config.isOpen && strigoWidget;

      // Setup won't do anything for now (child will only be able to send events later)
      if (isPanelOpen || this.config.sdkType === SdkTypes.CHILD) {
        Logger.info('panel is already opened. Aborting "setup" action...');

        return;
      }

      if (!this.config.initialized) {
        throw new Error('SDK was not initialized');
      }

      const config = configManager.getLocalStorageConfig();

      const {
        email,
        token,
        version,
        openWidget = true,
        dockingSide = DockingSide.RIGHT,
      } = { ...config.user, ...config, ...data };

      if (!email || !token) {
        throw new Error('Setup data is missing');
      }

      const configuration = await configManager.fetchRemoteConfiguration(token);

      if (!configuration?.allowedAcademyDomains?.includes(window.location.host.replace(/^www\./i, ''))) {
        console.log('Running on an unrelated domain. Aborting...', {
          allowedDomains: configuration?.allowedAcademyDomains,
          currentHost: window.location.host,
        });

        return;
      }

      if (configuration) {
        const { loggingConfig, userAssessments } = configuration;
        Logger.debug('Configuration fetched from Strigo');
        Logger.setup(loggingConfig);

        assessmentsStorage.setupAssessmentStorage(userAssessments);
      }

      configManager.setupLocalStorageConfig({
        user: {
          email,
          token,
        },
        initSite: urlTools.getUrlData(),
        version,
        loggingConfig: configuration?.loggingConfig,
        dockingSide,
      });

      this.config.configured = true;
      Logger.info('Finished SDK setup.');

      if (openWidget) {
        this.open();
      }
    } catch (err) {
      Logger.error('Could not setup SDK', { err });
    }
  }

  open(): void {
    try {
      Logger.info('Opening academy panel...');

      if (!this.config.configured) {
        throw new Error('SDK was not set up');
      }

      const strigoWidget = document.getElementById('strigo-widget');
      const isPanelOpen = this.config.isOpen && strigoWidget;

      if (isPanelOpen || this.config.sdkType === SdkTypes.CHILD) {
        Logger.info('Panel is already opened. Aborting "open" action...');

        return;
      }

      const config = configManager.getLocalStorageConfig();

      sessionManager.setupSessionStorage({
        currentUrl: config.initSite.href,
        shouldPanelBeOpen: sessionManager.shouldPanelBeOpen(),
        isLoading: true,
        widgetFlavor: config.selectedWidgetFlavor,
      });

      const widget = widgetFactory.getWidget(config.selectedWidgetFlavor);
      widget.setup({ version: config.version });
      this.config.isOpen = true;
      Logger.info('Opened academy panel.');
    } catch (err) {
      Logger.error('Could not open academy panel', { err });
    }
  }

  collapse(): void {
    Logger.info('Collapsing academy panel');
    const { selectedWidgetFlavor } = configManager.getLocalStorageConfig();

    const widget = widgetFactory.getWidget(selectedWidgetFlavor);
    widget.collapse();
  }

  shutdown(): void {
    try {
      Logger.info('Closing academy panel...');

      if (this.config.sdkType === SdkTypes.CHILD) {
        window.parent.postMessage(JSON.stringify({ messageType: MessageTypes.SHUTDOWN }), '*');
        Logger.info('Notified parent frame to close academy panel.');

        return;
      }

      if (!this.config.isOpen) {
        Logger.info('Tried to close unopened academy panel');

        return;
      }

      const widget = widgetFactory.getWidget(sessionManager.getWidgetFlavor());
      sessionManager.clearSession();

      widget.collapse();
      widget.shutdown();
      this.config.isOpen = false;
      Logger.info('Closed academy panel.');
    } catch (err) {
      Logger.error('Could not close academy panel', { err });
    }
  }

  destroy(): void {
    try {
      Logger.info('Destroying SDK...');

      if (this.config.sdkType === SdkTypes.CHILD) {
        window.parent.postMessage(JSON.stringify({ messageType: MessageTypes.DESTROY }), '*');
        Logger.info('Notified parent frame to destroy SDK.');

        return;
      }

      // Clear the local storage configs before widget shutdown to ensure that
      // the config will be erased even for iframe widget that reloads the page on shutdown.
      configManager.clearConfig();
      eventsStorageManager.clearEventsStorage();
      assessmentsStorage.clearAssessmentStorage();
      this.shutdown();

      this.config = {};

      Logger.info('Destroyed SDK.');
    } catch (err) {
      Logger.error('Could not destroy SDK', { err });
    }
  }

  sendEvent(eventName: string): void {
    eventsStorageManager.pushEventValue({ eventName });
    Logger.debug('sendEvent called', { eventName });
  }

  startElementSelector(onElementProfileCreated: any, rootElementSelector?: string): void {
    Logger.debug('startElementSelector called');
    const rootElement = rootElementSelector ? window.document.querySelector(rootElementSelector) : window.document.body;
    startElementSelector(window.document, { onElementProfileCreated, zIndex: 9999999999, rootElement });
  }

  assessmentRecorder(): void {
    assessmentRecorderModule.addAssessmentRecorderIframe();
  }
}

export const Strigo = new StrigoSDK();
