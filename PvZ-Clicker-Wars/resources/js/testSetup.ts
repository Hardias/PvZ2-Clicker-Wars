// jsdom tries to load <img src="/..."> against an absolute file URL during
// component mounting, which throws. Block asset image loads (both the DOM-prop
// and setAttribute write paths) so mounting components is side-effect free.
Object.defineProperty(HTMLImageElement.prototype, 'src', {
  configurable: true,
  get() {
    return this.getAttribute('src') ?? '';
  },
  set() {},
});

const originalSetAttribute = Element.prototype.setAttribute;
Element.prototype.setAttribute = function setAttributeSwallowingAssets(name: string, value: string) {
  if (name.toLowerCase() === 'src' && typeof value === 'string' && value.startsWith('/')) {
    return;
  }
  originalSetAttribute.call(this, name, value);
};