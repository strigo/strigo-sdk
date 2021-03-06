import { getElementProfiler } from './element-profiler.js';

function getElementProfile(e, { dataAttribute } = {}) {
  const elementProfiler = getElementProfiler();

  const options = {
    buildNodesInfoUpToRoot: true,
    optimizedMinLength: e.target.id ? 2 : 10,
    threshold: 1000,
    attr: (name) => name === dataAttribute,
    // className: className => !className.includes('sc-')
  };

  const nodesInfo = elementProfiler.getElementProfileNodesInfo(e.target, options);

  console.log('*** Just FYI - this is how it can generate css selector:',
    elementProfiler.generateSelectorFromNodesInfo(nodesInfo, options)
  );

  return nodesInfo;
}

export function getElementSelector(nodesInfo, options) {
  const elementProfiler = getElementProfiler();

  const defaultOptions = {
    allowDuplicates: false,
    optimizedMinLength: 10,
    threshold: 1000,
    attr: (name) => name === dataAttribute,
    fallbackNodesInfo: nodesInfo
  };

  const consolidatedOptions = { ...defaultOptions, ...options };

  const elementSelector = elementProfiler.generateSelectorFromNodesInfo(nodesInfo, consolidatedOptions);

  return elementSelector;
}

/**
 * This function will add an overlay for hovered element to indicate the element selection functionality.
 * @param {Object} options - The element selector options
 * @param [options.onElementProfileCreated] { function } - A callback to return the selected element profile.
 * @param [options.zIndex] { number } - A configurable z-index in which the selection overlay will appear.
 * @param [options.rootElement] { HtmlElement } - The starting dom element for the selection.
 * @param rootDocument- {DOMNode} The root document in which the selection overlay will append itself to hovered elements.
 */
export function startElementSelector(rootDocument, options) {
  // this.rootElement = options?.rootElement ? options.rootElement : rootDocument.body;

  this.saveSelectedSelector = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Removing mouse over event listener from the selected element.');
    rootDocument.removeEventListener("mouseover", this.mouseOverEvent);

    // this.rootElement.removeEventListener('mouseover', this.mouseOverEvent);

    const elementProfile = getElementProfile(e, {
      dataAttribute: 'some-custom-strigo-attribute',
    });

    this.elementProfile = elementProfile || {};

    const selectorOverlay = rootDocument.getElementById('element-selector-overlay');
    if (!selectorOverlay) {
      console.error('Missing selector overlay element!');
    }

    rootDocument?.body?.removeChild(selectorOverlay);
    // this.rootElement?.removeChild(selectorOverlay);

    console.log('Selected element with elementProfile:', this.elementProfile);
    options.onElementProfileCreated(this.elementProfile);
  };

  function setStyle(el, propertyObject) {
    for (const property in propertyObject) {
      el.style[property] = propertyObject[property];
    }
  }

  this.move = (e, overlayElement, skippedSelectors = []) => {
    if (overlayElement === e.target) {
      return;
    }

    const element = e.target;

    if (skippedSelectors.includes(element.id)) {
      return;
    }

    // if (element === this.rootElement) {
    //   const rootElementDimensions = this.rootElement.getBoundingClientRect();
    //   setStyle(overlayElement, {
    //     top: `${rootElementDimensions.top}px`,
    //     left: `${rootElementDimensions.left}px`,
    //     width: `${rootElementDimensions.width}px`,
    //     height: `${rootElementDimensions.height}px`,
    //   });

    //   return;
    // }

    const calcDimensions = {
      top: -window.scrollY,
      left: -window.scrollX,
    };

    let elem = e.target;
    while (elem && elem !== rootDocument.body) {
      calcDimensions.top += elem.offsetTop;
      calcDimensions.left += elem.offsetLeft;
      elem = elem.offsetParent;
    }

    const width = element.offsetWidth + 2;
    const height = element.offsetHeight + 2;

    const newDimensions = {
      top: calcDimensions.top - 2 + 'px',
      left: calcDimensions.left - 2 + 'px',
      width: width + 'px',
      height: height + 'px',
    };

    setStyle(overlayElement, newDimensions);
  };

  this.mouseOverEvent = (e) => {
    const overlayElement = rootDocument.getElementById('element-selector-overlay'); // TODO: See if we can pass the element instead of fetching it
    this.move(e, overlayElement, ['element-selector-overlay', 'strigo-assessment-recorder-iframe']);
    const hoveredElement = e.target;
    hoveredElement.addEventListener('click', this.saveSelectedSelector);
  };

  this.removeClickListenerFromHoveredElement = (e) => {
    const hoveredElement = e.target;
    hoveredElement.removeEventListener('click', this.saveSelectedSelector);
  };

  const selectorOverlay = rootDocument.createElement('div');
  selectorOverlay.setAttribute('id', 'element-selector-overlay');

  selectorOverlay.setAttribute("id", "element-selector-overlay");
  selectorOverlay.setAttribute(
    "style",
    `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: ${options.zIndex || 2147483646};
      padding: 1px;
      position: fixed;
      background: rgba(105, 108, 191, 0.2);
      border: 2px dashed #696CBF;
      box-sizing: border-box;
      border-radius: 4px;
    `
  );

  // const rootElementDimensions = this.rootElement.getBoundingClientRect();
  // selectorOverlay.setAttribute(
  //   'style',
  //   `
  //     top: ${rootElementDimensions.top}px;
  //     left: ${rootElementDimensions.left}px;
  //     width: ${rootElementDimensions.width}px;
  //     height: ${rootElementDimensions.height}px;
  //     pointer-events: none;
  //     z-index: ${options.zIndex || 2147483646};
  //     padding: 1px;
  //     position: fixed;
  //     background: rgba(105, 108, 191, 0.2);
  //     border: 2px dashed #696CBF;
  //     box-sizing: border-box;
  //     border-radius: 4px;
  //   `
  // );

  console.log('Appending overlay selector element.');
  // this.rootElement.appendChild(selectorOverlay);
  // this.rootElement.addEventListener('mouseover', this.mouseOverEvent);
  // this.rootElement.addEventListener('mouseout', this.removeClickListenerFromHoveredElement);

  rootDocument.body.appendChild(selectorOverlay);
  rootDocument.addEventListener("mouseover", this.mouseOverEvent);
  rootDocument.addEventListener("mouseout", this.removeClickListenerFromHoveredElement);
}
