var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _JSONFileMin_adapter;
import { TextFile } from 'lowdb';
export class JSONFileMin {
    constructor(filename) {
        _JSONFileMin_adapter.set(this, void 0);
        __classPrivateFieldSet(this, _JSONFileMin_adapter, new TextFile(filename), "f");
    }
    async read() {
        const data = await __classPrivateFieldGet(this, _JSONFileMin_adapter, "f").read();
        if (data === null) {
            return null;
        }
        else {
            return JSON.parse(data);
        }
    }
    write(obj) {
        return __classPrivateFieldGet(this, _JSONFileMin_adapter, "f").write(JSON.stringify(obj)); // <- minified JSON
    }
}
_JSONFileMin_adapter = new WeakMap();
