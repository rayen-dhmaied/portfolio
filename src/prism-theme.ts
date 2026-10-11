import type {PrismTheme} from 'prism-react-renderer';

// Code blocks: a few calm colors on the site's dark surface, no glow, no italics.
// Every color is at least 6:1 against the background.
const theme: PrismTheme = {
  plain: {color: '#e6e1ef', backgroundColor: '#130f1b'},
  styles: [
    {types: ['comment', 'prolog', 'doctype', 'cdata'], style: {color: '#9a8fae'}},
    {types: ['punctuation', 'operator'], style: {color: '#b3a9c6'}},
    {types: ['atrule', 'property', 'attr-name', 'tag', 'selector', 'function'], style: {color: '#5cbfff'}},
    {types: ['keyword', 'builtin', 'important', 'class-name'], style: {color: '#ff8cc6'}},
    {types: ['string', 'char', 'attr-value', 'url', 'regex', 'inserted'], style: {color: '#ffd479'}},
    {types: ['number', 'boolean', 'constant', 'symbol'], style: {color: '#c3a6ff'}},
    {types: ['deleted'], style: {color: '#ff6680'}},
    {types: ['bold'], style: {fontWeight: 'bold'}},
    {types: ['italic'], style: {fontStyle: 'italic'}},
  ],
};

export default theme;
