// Declare needed GM APIs.
// Ref: https://violentmonkey.github.io/api/gm/#gm_registermenucommand
// and Tampermonkey compatibility
declare function GM_registerMenuCommand(caption: string, onClick: () => void): number | void;
declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
declare function GM_setValue<T = unknown>(key: string, value: T): void;
