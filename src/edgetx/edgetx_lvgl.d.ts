/**
 * EdgeTX's LVGL objects for Lua (2.11 on), as far as the widgets here use them. A widget that returns `useLvgl = true`
 * builds its objects once (lvgl.build); EdgeTX then calls each property given as a function at every refresh and
 * redraws an object only when what it returns has changed.
 */
type LvglValue<T> = T | (() => T);

declare interface LvglObject {
  type: 'label' | 'rectangle' | 'hline' | 'vline' | 'line' | 'triangle' | 'circle' | 'arc' | 'image' | 'box';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  color?: LvglValue<number>;
  /** Where the object is now (x, y): the centre for a circle. */
  pos?: () => LuaMultiReturn<[number, number]>;
  visible?: () => boolean;
  /** A label's text, font (TINSIZE, SMLSIZE...) and alignment in its box (CENTER, RIGHT, which need `w`). */
  text?: LvglValue<string>;
  font?: LvglValue<number>;
  align?: LvglValue<number>;
  filled?: LvglValue<boolean>;
  thickness?: number;
  rounded?: boolean | number;
  radius?: LvglValue<number>;
  /** A line's points, or a triangle's three: {x, y} pairs. */
  pts?: LvglValue<[number, number][]>;
  /** An image's file on the card, shown in (x, y, w, h). */
  file?: string;
  fill?: boolean;
  children?: LvglObject[];
}

declare module lvgl {
  function clear(): void;
  function build(objects: LvglObject[]): void;
}
