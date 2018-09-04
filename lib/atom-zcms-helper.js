'use babel';

import AtomZcmsHelperView from './atom-zcms-helper-view';
import { CompositeDisposable } from 'atom';

export default {

  atomZcmsHelperView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.atomZcmsHelperView = new AtomZcmsHelperView(state.atomZcmsHelperViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.atomZcmsHelperView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-zcms-helper:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.atomZcmsHelperView.destroy();
  },

  serialize() {
    return {
      atomZcmsHelperViewState: this.atomZcmsHelperView.serialize()
    };
  },

  toggle() {
    console.log('AtomZcmsHelper was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
