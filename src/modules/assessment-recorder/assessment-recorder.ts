import html2canvas from 'html2canvas';

import { Logger } from '../../services/logger';
import { appendCssFile, appendIFrame, getHeadElement } from '../document/document';
import { getElementSelector } from '../element-selector/element-selector';
import { generateAssessmentRecorderURL, generateRecorderCssURL, getURLWithoutStrigoRecorderParams } from '../url/url';
import { RecordedElementProfile } from '../no-code-assessment/no-code-assessment.types';

import {
  AssessmentRecorderMessage,
  AssessmentRecorderMessageTypes,
  CaptureParams,
  SelectedElement,
  ASSESSMENT_RECORDER_ID_PARAM,
} from './assessment-recorder.types';

export function isRecordingMode(): boolean {
  return !!window.sessionStorage.getItem(ASSESSMENT_RECORDER_ID_PARAM);
}

function onElementProfileCreation(elementProfile: RecordedElementProfile, elementType): void {
  const recorederIframe = document.getElementById('strigo-assessment-recorder-iframe') as HTMLIFrameElement;
  const { nodeTree } = elementProfile;
  const elementSelector = getElementSelector(nodeTree);

  html2canvas(document.querySelector(elementSelector), { backgroundColor: '#c6c7e7' }).then((canvas) => {
    const selectedElement: SelectedElement = {
      imageData: canvas.toDataURL(),
      profile: elementProfile,
      querySelector: elementSelector,
    };

    recorederIframe.contentWindow.postMessage(
      JSON.stringify({
        messageType: AssessmentRecorderMessageTypes.END_CAPTURE,
        payload: {
          elementType,
          selectedElement,
        },
        windowName: window.name,
      }),
      '*'
    );

    recorederIframe.classList.replace('slide-from-opened-to-minimized', 'slide-from-minimized-to-opened');
  });
}

function onElementSelectionCancel(elementType?: string): void {
  Logger.info('Aborting element selection...');
  const recorederIframe = document.getElementById('strigo-assessment-recorder-iframe') as HTMLIFrameElement;
  recorederIframe.classList.replace('slide-from-opened-to-minimized', 'slide-from-minimized-to-opened');

  recorederIframe.contentWindow.postMessage(
    JSON.stringify({
      messageType: AssessmentRecorderMessageTypes.END_CAPTURE,
      payload: {
        elementType,
        selectedElement: null,
      },
      windowName: window.name,
    }),
    '*'
  );
}

export function addAssessmentRecorderIframe(): void {
  if (document.getElementById('strigo-assessment-recorder-iframe')) {
    return;
  }

  const assessmentRecorderUrl = generateAssessmentRecorderURL();
  appendCssFile({ parentElement: getHeadElement(), url: generateRecorderCssURL() });
  const assessmentRecorderIframe = appendIFrame({
    classNames: ['strigo-assessment-recorder-iframe', 'opened'],
    id: 'strigo-assessment-recorder-iframe',
    parentElement: window.document.body,
    url: assessmentRecorderUrl,
  });

  window.addEventListener(
    'message',
    (ev: MessageEvent<any>) => {
      if (!ev || !ev.data || ev.origin !== assessmentRecorderUrl) {
        return;
      }

      let recorderMessage: AssessmentRecorderMessage;

      try {
        recorderMessage = JSON.parse(ev.data);
      } catch (err) {
        return;
      }

      const { messageType, payload } = recorderMessage;

      switch (messageType) {
        case AssessmentRecorderMessageTypes.START_CAPTURE: {
          Logger.info('Start capturing message received');
          const wasReplaced = assessmentRecorderIframe.classList.replace('opened', 'slide-from-opened-to-minimized');

          if (!wasReplaced) {
            assessmentRecorderIframe.classList.replace(
              'slide-from-minimized-to-opened',
              'slide-from-opened-to-minimized'
            );
          }

          const { elementType, rootElementSelector } = payload?.captureParams as CaptureParams;

          window.Strigo.startElementSelector(
            (elementProfile: RecordedElementProfile) => onElementProfileCreation(elementProfile, elementType),
            () => onElementSelectionCancel(elementType),
            rootElementSelector
          );

          break;
        }

        case AssessmentRecorderMessageTypes.STOP_CAPTURE: {
          Logger.info('Stop capturing message received');
          assessmentRecorderIframe.classList.replace(
            'slide-from-opened-to-minimized',
            'slide-from-minimized-to-opened'
          );

          window.Strigo.stopElementSelector();

          break;
        }

        case AssessmentRecorderMessageTypes.SUBMIT_ASSESSMENT: {
          const recorderWindowId = window.sessionStorage.getItem(ASSESSMENT_RECORDER_ID_PARAM);
          const urlToSave = getURLWithoutStrigoRecorderParams(window.location.href);

          window.opener.postMessage(
            {
              assessment: {
                ...payload.assessment,
                url: urlToSave,
              },
              recorderWindowId,
            },
            '*'
          );
          window.close();

          break;
        }

        case AssessmentRecorderMessageTypes.CANCEL_ASSESSMENT: {
          window.close();

          break;
        }

        default: {
          break;
        }
      }
    },
    false
  );
}
