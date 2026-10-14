import { Version } from '@microsoft/sp-core-library';
import type { IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import * as strings from 'RezeptionWebPartStrings';
import { APP_CSS, mount } from './app.gen';

export interface IRezeptionWebPartProps {
}

export default class RezeptionWebPart extends BaseClientSideWebPart<IRezeptionWebPartProps> {

  private _shadowRoot: ShadowRoot | undefined;
  private _unmount: (() => void) | undefined;

  public render(): void {
    if (this._shadowRoot) {
      // Already mounted: the app manages its own state, nothing to do.
      return;
    }

    const shadowRoot: ShadowRoot = this.domElement.attachShadow({ mode: 'open' });
    this._shadowRoot = shadowRoot;

    const style: HTMLStyleElement = document.createElement('style');
    style.textContent = APP_CSS;
    shadowRoot.appendChild(style);

    const container: HTMLDivElement = document.createElement('div');
    container.className = 'rz-root';
    shadowRoot.appendChild(container);

    this._unmount = mount(container, {
      mode: 'sharepoint',
      root: shadowRoot,
      webAbsoluteUrl: this.context.pageContext.web.absoluteUrl,
      webServerRelativeUrl: this.context.pageContext.web.serverRelativeUrl,
      library: 'RezeptionDaten',
      // Querformat: App füllt den Bildschirm bis zum unteren Rand, Karten scrollen intern.
      fitViewport: true
    });
  }

  protected onDispose(): void {
    if (this._unmount) {
      this._unmount();
      this._unmount = undefined;
    }
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: []
        }
      ]
    };
  }
}
