const svg = (body, w=96, h=48) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
const shadow='<ellipse cx="48" cy="37" rx="39" ry="7" fill="#000" opacity=".48"/>';
const glass='<path d="M29 15h28l9 9H20z" fill="#171b20"/><path d="M31 17h12v5H25zM46 17h10l6 5H46z" fill="#555b61" opacity=".65"/>';
export const VEHICLE_ASSETS = {
  sedan: svg(`${shadow}<rect x="11" y="21" width="74" height="15" rx="5" fill="#555b61"/><path d="M19 22l10-12h31l16 12z" fill="#6d7379"/>${glass}<rect x="16" y="30" width="6" height="4" fill="#d4523a"/><rect x="74" y="30" width="6" height="4" fill="#d4523a"/>`),
  coupe: svg(`${shadow}<path d="M10 30l14-13 22-5 24 7 16 11q2 6-5 7H17q-7 0-7-7z" fill="#3d4146"/>${glass}<path d="M25 16h24l12 7H20z" fill="#15191d"/><rect x="14" y="29" width="8" height="4" fill="#d4523a"/><rect x="75" y="29" width="7" height="4" fill="#d4523a"/>`),
  taxi: svg(`${shadow}<rect x="9" y="21" width="78" height="15" rx="5" fill="#e8b84a"/><path d="M20 21l10-11h30l15 11z" fill="#e8b84a"/>${glass}<rect x="42" y="7" width="12" height="5" rx="1" fill="#e8b84a"/><rect x="75" y="30" width="7" height="4" fill="#d4523a"/>`),
  police: svg(`${shadow}<rect x="9" y="21" width="78" height="15" rx="5" fill="#e7e7e3"/><path d="M20 21l10-11h30l15 11z" fill="#c7c9ca"/>${glass}<path d="M9 27h78v5H9z" fill="#20252b"/><rect x="39" y="7" width="18" height="5" rx="2" fill="#d4523a"/><rect x="43" y="7" width="9" height="5" fill="#596068"/>`),
  van: svg(`${shadow}<rect x="8" y="14" width="80" height="22" rx="4" fill="#8a8f94"/><path d="M14 17h24v12H14z" fill="#171b20"/><path d="M42 17h38v12H42z" fill="#34383d"/><rect x="73" y="29" width="8" height="4" fill="#d4523a"/>`),
  truck: svg(`${shadow}<rect x="30" y="10" width="52" height="25" rx="3" fill="#6d7379"/><rect x="8" y="18" width="27" height="17" rx="3" fill="#9aa0a8"/>${glass}<rect x="72" y="29" width="8" height="4" fill="#d4523a"/>`)
};
export const BUILDING_ASSETS = {
  brick: svg('<path d="M5 43V9L20 3h61l10 6v34z" fill="#34373c"/><path d="M5 9L20 3v40H5z" fill="#24272b"/><path d="M20 3h61v40H20z" fill="#45494f"/><g fill="#e09a3e" opacity=".38"><rect x="28" y="10" width="8" height="6"/><rect x="44" y="10" width="8" height="6"/><rect x="60" y="10" width="8" height="6"/><rect x="28" y="22" width="8" height="6"/><rect x="44" y="22" width="8" height="6"/><rect x="60" y="22" width="8" height="6"/><rect x="36" y="34" width="12" height="9"/></g>'),
  warehouse: svg('<path d="M4 43V16L48 3l44 13v27z" fill="#272a2f"/><path d="M48 3v40h44V16z" fill="#3b3f44"/><g fill="#15181b"><rect x="12" y="23" width="24" height="20"/><rect x="57" y="23" width="25" height="20"/></g><path d="M8 18L48 6l40 12" fill="none" stroke="#9aa0a8" opacity=".45"/>')
};
export const PED_ASSETS = {
  civilian: svg('<ellipse cx="48" cy="43" rx="11" ry="3" fill="#000" opacity=".4"/><circle cx="48" cy="13" r="6" fill="#b98f72"/><path d="M40 21h16l5 15H35z" fill="#596068"/><path d="M42 35l-5 8M54 35l5 8" stroke="#202327" stroke-width="4" stroke-linecap="round"/>',64,48),
  runner: svg('<ellipse cx="48" cy="43" rx="11" ry="3" fill="#000" opacity=".4"/><circle cx="48" cy="13" r="6" fill="#b98f72"/><path d="M40 21h16l7 13H35z" fill="#d4523a"/><path d="M42 34l-9 8M54 34l10 3" stroke="#202327" stroke-width="4" stroke-linecap="round"/>',64,48)
};
