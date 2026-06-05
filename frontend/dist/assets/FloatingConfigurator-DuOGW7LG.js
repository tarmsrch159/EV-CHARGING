import{S as W}from"./index-B8OKPD8K.js";import{P as D,B as $,ae as z,R as F,aQ as T,ac as G,G as I,c as g,a as b,b as u,Q as _,n as w,z as Y,m as y,t as E,ap as B,a3 as x,W as J,F as O,N as L,I as X,a5 as Z,w as ee,u as K,r as m,bd as te,M as A,h,d as k,be as oe,bf as ne,bg as ae,s as re}from"./index-DS3rIZVd.js";import{s as M}from"./index-BxT0AIj3.js";import{i as le}from"./index-D9ENQpIJ.js";var ie=D`
    .p-togglebutton {
        display: inline-flex;
        cursor: pointer;
        user-select: none;
        overflow: hidden;
        position: relative;
        color: dt('togglebutton.color');
        background: dt('togglebutton.background');
        border: 1px solid dt('togglebutton.border.color');
        padding: dt('togglebutton.padding');
        font-size: 1rem;
        font-family: inherit;
        font-feature-settings: inherit;
        transition:
            background dt('togglebutton.transition.duration'),
            color dt('togglebutton.transition.duration'),
            border-color dt('togglebutton.transition.duration'),
            outline-color dt('togglebutton.transition.duration'),
            box-shadow dt('togglebutton.transition.duration');
        border-radius: dt('togglebutton.border.radius');
        outline-color: transparent;
        font-weight: dt('togglebutton.font.weight');
    }

    .p-togglebutton-content {
        display: inline-flex;
        flex: 1 1 auto;
        align-items: center;
        justify-content: center;
        gap: dt('togglebutton.gap');
        padding: dt('togglebutton.content.padding');
        background: transparent;
        border-radius: dt('togglebutton.content.border.radius');
        transition:
            background dt('togglebutton.transition.duration'),
            color dt('togglebutton.transition.duration'),
            border-color dt('togglebutton.transition.duration'),
            outline-color dt('togglebutton.transition.duration'),
            box-shadow dt('togglebutton.transition.duration');
    }

    .p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover {
        background: dt('togglebutton.hover.background');
        color: dt('togglebutton.hover.color');
    }

    .p-togglebutton.p-togglebutton-checked {
        background: dt('togglebutton.checked.background');
        border-color: dt('togglebutton.checked.border.color');
        color: dt('togglebutton.checked.color');
    }

    .p-togglebutton-checked .p-togglebutton-content {
        background: dt('togglebutton.content.checked.background');
        box-shadow: dt('togglebutton.content.checked.shadow');
    }

    .p-togglebutton:focus-visible {
        box-shadow: dt('togglebutton.focus.ring.shadow');
        outline: dt('togglebutton.focus.ring.width') dt('togglebutton.focus.ring.style') dt('togglebutton.focus.ring.color');
        outline-offset: dt('togglebutton.focus.ring.offset');
    }

    .p-togglebutton.p-invalid {
        border-color: dt('togglebutton.invalid.border.color');
    }

    .p-togglebutton:disabled {
        opacity: 1;
        cursor: default;
        background: dt('togglebutton.disabled.background');
        border-color: dt('togglebutton.disabled.border.color');
        color: dt('togglebutton.disabled.color');
    }

    .p-togglebutton-label,
    .p-togglebutton-icon {
        position: relative;
        transition: none;
    }

    .p-togglebutton-icon {
        color: dt('togglebutton.icon.color');
    }

    .p-togglebutton:not(:disabled):not(.p-togglebutton-checked):hover .p-togglebutton-icon {
        color: dt('togglebutton.icon.hover.color');
    }

    .p-togglebutton.p-togglebutton-checked .p-togglebutton-icon {
        color: dt('togglebutton.icon.checked.color');
    }

    .p-togglebutton:disabled .p-togglebutton-icon {
        color: dt('togglebutton.icon.disabled.color');
    }

    .p-togglebutton-sm {
        padding: dt('togglebutton.sm.padding');
        font-size: dt('togglebutton.sm.font.size');
    }

    .p-togglebutton-sm .p-togglebutton-content {
        padding: dt('togglebutton.content.sm.padding');
    }

    .p-togglebutton-lg {
        padding: dt('togglebutton.lg.padding');
        font-size: dt('togglebutton.lg.font.size');
    }

    .p-togglebutton-lg .p-togglebutton-content {
        padding: dt('togglebutton.content.lg.padding');
    }
`,se={root:function(t){var o=t.instance,a=t.props;return["p-togglebutton p-component",{"p-togglebutton-checked":o.active,"p-invalid":o.$invalid,"p-togglebutton-sm p-inputfield-sm":a.size==="small","p-togglebutton-lg p-inputfield-lg":a.size==="large"}]},content:"p-togglebutton-content",icon:"p-togglebutton-icon",label:"p-togglebutton-label"},de=$.extend({name:"togglebutton",style:ie,classes:se}),ue={name:"BaseToggleButton",extends:M,props:{onIcon:String,offIcon:String,onLabel:{type:String,default:"Yes"},offLabel:{type:String,default:"No"},iconPos:{type:String,default:"left"},readonly:{type:Boolean,default:!1},tabindex:{type:Number,default:null},ariaLabelledby:{type:String,default:null},ariaLabel:{type:String,default:null},size:{type:String,default:null}},style:de,provide:function(){return{$pcToggleButton:this,$parentInstance:this}}};function S(e){"@babel/helpers - typeof";return S=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},S(e)}function fe(e,t,o){return(t=ce(t))in e?Object.defineProperty(e,t,{value:o,enumerable:!0,configurable:!0,writable:!0}):e[t]=o,e}function ce(e){var t=be(e,"string");return S(t)=="symbol"?t:t+""}function be(e,t){if(S(e)!="object"||!e)return e;var o=e[Symbol.toPrimitive];if(o!==void 0){var a=o.call(e,t);if(S(a)!="object")return a;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}var j={name:"ToggleButton",extends:ue,inheritAttrs:!1,emits:["change"],methods:{getPTOptions:function(t){var o=t==="root"?this.ptmi:this.ptm;return o(t,{context:{active:this.active,disabled:this.disabled}})},onChange:function(t){!this.disabled&&!this.readonly&&(this.writeValue(!this.d_value,t),this.$emit("change",t))},onBlur:function(t){var o,a;(o=(a=this.formField).onBlur)===null||o===void 0||o.call(a,t)}},computed:{active:function(){return this.d_value===!0},hasLabel:function(){return T(this.onLabel)&&T(this.offLabel)},label:function(){return this.hasLabel?this.d_value?this.onLabel:this.offLabel:" "},dataP:function(){return F(fe({checked:this.active,invalid:this.$invalid},this.size,this.size))}},directives:{ripple:z}},pe=["tabindex","disabled","aria-pressed","aria-label","aria-labelledby","data-p-checked","data-p-disabled","data-p"],ge=["data-p"];function me(e,t,o,a,d,n){var s=G("ripple");return I((b(),g("button",y({type:"button",class:e.cx("root"),tabindex:e.tabindex,disabled:e.disabled,"aria-pressed":e.d_value,onClick:t[0]||(t[0]=function(){return n.onChange&&n.onChange.apply(n,arguments)}),onBlur:t[1]||(t[1]=function(){return n.onBlur&&n.onBlur.apply(n,arguments)})},n.getPTOptions("root"),{"aria-label":e.ariaLabel,"aria-labelledby":e.ariaLabelledby,"data-p-checked":n.active,"data-p-disabled":e.disabled,"data-p":n.dataP}),[u("span",y({class:e.cx("content")},n.getPTOptions("content"),{"data-p":n.dataP}),[_(e.$slots,"default",{},function(){return[_(e.$slots,"icon",{value:e.d_value,class:w(e.cx("icon"))},function(){return[e.onIcon||e.offIcon?(b(),g("span",y({key:0,class:[e.cx("icon"),e.d_value?e.onIcon:e.offIcon]},n.getPTOptions("icon")),null,16)):Y("",!0)]}),u("span",y({class:e.cx("label")},n.getPTOptions("label")),E(n.label),17)]})],16,ge)],16,pe)),[[s]])}j.render=me;var ye=D`
    .p-selectbutton {
        display: inline-flex;
        user-select: none;
        vertical-align: bottom;
        outline-color: transparent;
        border-radius: dt('selectbutton.border.radius');
    }

    .p-selectbutton .p-togglebutton {
        border-radius: 0;
        border-width: 1px 1px 1px 0;
    }

    .p-selectbutton .p-togglebutton:focus-visible {
        position: relative;
        z-index: 1;
    }

    .p-selectbutton .p-togglebutton:first-child {
        border-inline-start-width: 1px;
        border-start-start-radius: dt('selectbutton.border.radius');
        border-end-start-radius: dt('selectbutton.border.radius');
    }

    .p-selectbutton .p-togglebutton:last-child {
        border-start-end-radius: dt('selectbutton.border.radius');
        border-end-end-radius: dt('selectbutton.border.radius');
    }

    .p-selectbutton.p-invalid {
        outline: 1px solid dt('selectbutton.invalid.border.color');
        outline-offset: 0;
    }
`,he={root:function(t){var o=t.instance;return["p-selectbutton p-component",{"p-invalid":o.$invalid}]}},ve=$.extend({name:"selectbutton",style:ye,classes:he}),ke={name:"BaseSelectButton",extends:M,props:{options:Array,optionLabel:null,optionValue:null,optionDisabled:null,multiple:Boolean,allowEmpty:{type:Boolean,default:!0},dataKey:null,ariaLabelledby:{type:String,default:null},size:{type:String,default:null}},style:ve,provide:function(){return{$pcSelectButton:this,$parentInstance:this}}};function Se(e,t){var o=typeof Symbol<"u"&&e[Symbol.iterator]||e["@@iterator"];if(!o){if(Array.isArray(e)||(o=R(e))||t){o&&(e=o);var a=0,d=function(){};return{s:d,n:function(){return a>=e.length?{done:!0}:{done:!1,value:e[a++]}},e:function(p){throw p},f:d}}throw new TypeError(`Invalid attempt to iterate non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}var n,s=!0,r=!1;return{s:function(){o=o.call(e)},n:function(){var p=o.next();return s=p.done,p},e:function(p){r=!0,n=p},f:function(){try{s||o.return==null||o.return()}finally{if(r)throw n}}}}function Ce(e){return _e(e)||Be(e)||R(e)||xe()}function xe(){throw new TypeError(`Invalid attempt to spread non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function R(e,t){if(e){if(typeof e=="string")return P(e,t);var o={}.toString.call(e).slice(8,-1);return o==="Object"&&e.constructor&&(o=e.constructor.name),o==="Map"||o==="Set"?Array.from(e):o==="Arguments"||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(o)?P(e,t):void 0}}function Be(e){if(typeof Symbol<"u"&&e[Symbol.iterator]!=null||e["@@iterator"]!=null)return Array.from(e)}function _e(e){if(Array.isArray(e))return P(e)}function P(e,t){(t==null||t>e.length)&&(t=e.length);for(var o=0,a=Array(t);o<t;o++)a[o]=e[o];return a}var N={name:"SelectButton",extends:ke,inheritAttrs:!1,emits:["change"],methods:{getOptionLabel:function(t){return this.optionLabel?x(t,this.optionLabel):t},getOptionValue:function(t){return this.optionValue?x(t,this.optionValue):t},getOptionRenderKey:function(t){return this.dataKey?x(t,this.dataKey):this.getOptionLabel(t)},isOptionDisabled:function(t){return this.optionDisabled?x(t,this.optionDisabled):!1},isOptionReadonly:function(t){if(this.allowEmpty)return!1;var o=this.isSelected(t);return this.multiple?o&&this.d_value.length===1:o},onOptionSelect:function(t,o,a){var d=this;if(!(this.disabled||this.isOptionDisabled(o)||this.isOptionReadonly(o))){var n=this.isSelected(o),s=this.getOptionValue(o),r;if(this.multiple)if(n){if(r=this.d_value.filter(function(f){return!B(f,s,d.equalityKey)}),!this.allowEmpty&&r.length===0)return}else r=this.d_value?[].concat(Ce(this.d_value),[s]):[s];else{if(n&&!this.allowEmpty)return;r=n?null:s}this.writeValue(r,t),this.$emit("change",{event:t,value:r})}},isSelected:function(t){var o=!1,a=this.getOptionValue(t);if(this.multiple){if(this.d_value){var d=Se(this.d_value),n;try{for(d.s();!(n=d.n()).done;){var s=n.value;if(B(s,a,this.equalityKey)){o=!0;break}}}catch(r){d.e(r)}finally{d.f()}}}else o=B(this.d_value,a,this.equalityKey);return o}},computed:{equalityKey:function(){return this.optionValue?null:this.dataKey},dataP:function(){return F({invalid:this.$invalid})}},directives:{ripple:z},components:{ToggleButton:j}},we=["aria-labelledby","data-p"];function Oe(e,t,o,a,d,n){var s=J("ToggleButton");return b(),g("div",y({class:e.cx("root"),role:"group","aria-labelledby":e.ariaLabelledby},e.ptmi("root"),{"data-p":n.dataP}),[(b(!0),g(O,null,L(e.options,function(r,f){return b(),X(s,{key:n.getOptionRenderKey(r),modelValue:n.isSelected(r),onLabel:n.getOptionLabel(r),offLabel:n.getOptionLabel(r),disabled:e.disabled||n.isOptionDisabled(r),unstyled:e.unstyled,size:e.size,readonly:n.isOptionReadonly(r),onChange:function(C){return n.onOptionSelect(C,r,f)},pt:e.ptm("pcToggleButton")},Z({_:2},[e.$slots.option?{name:"default",fn:ee(function(){return[_(e.$slots,"option",{option:r,index:f},function(){return[u("span",y({ref_for:!0},e.ptm("pcToggleButton").label),E(n.getOptionLabel(r)),17)]})]}),key:"0"}:void 0]),1032,["modelValue","onLabel","offLabel","disabled","unstyled","size","readonly","onChange","pt"])}),128))],16,we)}N.render=Oe;const Le={class:"config-panel hidden absolute top-[3.25rem] right-0 w-64 p-4 bg-surface-0 dark:bg-surface-900 border border-surface rounded-border origin-top shadow-[0px_3px_5px_rgba(0,0,0,0.02),0px_0px_2px_rgba(0,0,0,0.05),0px_1px_4px_rgba(0,0,0,0.08)]"},Pe={class:"flex flex-col gap-4"},Ve={class:"pt-2 flex gap-2 flex-wrap justify-between"},Te=["title","onClick"],Ae={class:"pt-2 flex gap-2 flex-wrap justify-between"},De=["title","onClick"],$e={class:"flex flex-col gap-2"},ze={class:"flex flex-col gap-2"},Fe={__name:"AppConfigurator",setup(e){const{layoutConfig:t,isDarkTheme:o}=K(),a={Aura:te,Lara:le},d=m(t.preset),n=m(Object.keys(a)),s=m(t.menuMode),r=m([{label:"Static",value:"static"},{label:"Overlay",value:"overlay"}]),f=m([{name:"noir",palette:{}},{name:"tms",palette:{50:"#D6E4DD",100:"#B8DDCC",200:"#9FC8B5",300:"#8FBFA9",400:"#7BAF97",500:"#157347",600:"#157347",700:"#157347",800:"#157347",900:"#157347",950:"#157347"}},{name:"emerald",palette:{50:"#ecfdf5",100:"#d1fae5",200:"#a7f3d0",300:"#6ee7b7",400:"#34d399",500:"#10b981",600:"#059669",700:"#047857",800:"#065f46",900:"#064e3b",950:"#022c22"}},{name:"green",palette:{50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16"}},{name:"lime",palette:{50:"#f7fee7",100:"#ecfccb",200:"#d9f99d",300:"#bef264",400:"#a3e635",500:"#84cc16",600:"#65a30d",700:"#4d7c0f",800:"#3f6212",900:"#365314",950:"#1a2e05"}},{name:"orange",palette:{50:"#fff7ed",100:"#ffedd5",200:"#fed7aa",300:"#fdba74",400:"#fb923c",500:"#f97316",600:"#ea580c",700:"#c2410c",800:"#9a3412",900:"#7c2d12",950:"#431407"}},{name:"amber",palette:{50:"#fffbeb",100:"#fef3c7",200:"#fde68a",300:"#fcd34d",400:"#fbbf24",500:"#f59e0b",600:"#d97706",700:"#b45309",800:"#92400e",900:"#78350f",950:"#451a03"}},{name:"yellow",palette:{50:"#fefce8",100:"#fef9c3",200:"#fef08a",300:"#fde047",400:"#f68e20",500:"#eab308",600:"#ca8a04",700:"#a16207",800:"#854d0e",900:"#713f12",950:"#422006"}},{name:"teal",palette:{50:"#f0fdfa",100:"#ccfbf1",200:"#99f6e4",300:"#5eead4",400:"#2dd4bf",500:"#14b8a6",600:"#0d9488",700:"#0f766e",800:"#115e59",900:"#134e4a",950:"#042f2e"}},{name:"cyan",palette:{50:"#ecfeff",100:"#cffafe",200:"#a5f3fc",300:"#67e8f9",400:"#22d3ee",500:"#06b6d4",600:"#0891b2",700:"#0e7490",800:"#155e75",900:"#164e63",950:"#083344"}},{name:"sky",palette:{50:"#f0f9ff",100:"#e0f2fe",200:"#bae6fd",300:"#7dd3fc",400:"#38bdf8",500:"#0ea5e9",600:"#0284c7",700:"#0369a1",800:"#075985",900:"#0c4a6e",950:"#082f49"}},{name:"blue",palette:{50:"#eff6ff",100:"#dbeafe",200:"#bfdbfe",300:"#93c5fd",400:"#60a5fa",500:"#3b82f6",600:"#2563eb",700:"#1d4ed8",800:"#1e40af",900:"#1e3a8a",950:"#172554"}},{name:"indigo",palette:{50:"#eef2ff",100:"#e0e7ff",200:"#c7d2fe",300:"#a5b4fc",400:"#818cf8",500:"#6366f1",600:"#4f46e5",700:"#4338ca",800:"#3730a3",900:"#312e81",950:"#1e1b4b"}},{name:"violet",palette:{50:"#f5f3ff",100:"#ede9fe",200:"#ddd6fe",300:"#c4b5fd",400:"#a78bfa",500:"#8b5cf6",600:"#7c3aed",700:"#6d28d9",800:"#5b21b6",900:"#4c1d95",950:"#2e1065"}},{name:"purple",palette:{50:"#faf5ff",100:"#f3e8ff",200:"#e9d5ff",300:"#d8b4fe",400:"#c084fc",500:"#a855f7",600:"#9333ea",700:"#7e22ce",800:"#6b21a8",900:"#581c87",950:"#3b0764"}},{name:"fuchsia",palette:{50:"#fdf4ff",100:"#fae8ff",200:"#f5d0fe",300:"#f0abfc",400:"#e879f9",500:"#d946ef",600:"#c026d3",700:"#a21caf",800:"#86198f",900:"#701a75",950:"#4a044e"}},{name:"pink",palette:{50:"#fdf2f8",100:"#fce7f3",200:"#fbcfe8",300:"#f9a8d4",400:"#f472b6",500:"#ec4899",600:"#db2777",700:"#be185d",800:"#9d174d",900:"#831843",950:"#500724"}},{name:"rose",palette:{50:"#fff1f2",100:"#ffe4e6",200:"#fecdd3",300:"#fda4af",400:"#fb7185",500:"#f43f5e",600:"#e11d48",700:"#be123c",800:"#9f1239",900:"#881337",950:"#4c0519"}}]),p=m([{name:"slate",palette:{0:"#ffffff",50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",500:"#64748b",600:"#475569",700:"#334155",800:"#1e293b",900:"#0f172a",950:"#020617"}},{name:"gray",palette:{0:"#ffffff",50:"#f9fafb",100:"#f3f4f6",200:"#e5e7eb",300:"#d1d5db",400:"#9ca3af",500:"#6b7280",600:"#4b5563",700:"#374151",800:"#1f2937",900:"#111827",950:"#030712"}},{name:"zinc",palette:{0:"#ffffff",50:"#fafafa",100:"#f4f4f5",200:"#e4e4e7",300:"#d4d4d8",400:"#a1a1aa",500:"#71717a",600:"#52525b",700:"#3f3f46",800:"#27272a",900:"#18181b",950:"#09090b"}},{name:"neutral",palette:{0:"#ffffff",50:"#fafafa",100:"#f5f5f5",200:"#e5e5e5",300:"#d4d4d4",400:"#a3a3a3",500:"#737373",600:"#525252",700:"#404040",800:"#262626",900:"#171717",950:"#0a0a0a"}},{name:"stone",palette:{0:"#ffffff",50:"#fafaf9",100:"#f5f5f4",200:"#e7e5e4",300:"#d6d3d1",400:"#a8a29e",500:"#78716c",600:"#57534e",700:"#44403c",800:"#292524",900:"#1c1917",950:"#0c0a09"}},{name:"soho",palette:{0:"#ffffff",50:"#f4f4f4",100:"#e8e9e9",200:"#d2d2d4",300:"#bbbcbe",400:"#a5a5a9",500:"#8e8f93",600:"#77787d",700:"#616268",800:"#4a4b52",900:"#34343d",950:"#1d1e27"}},{name:"viva",palette:{0:"#ffffff",50:"#f3f3f3",100:"#e7e7e8",200:"#cfd0d0",300:"#b7b8b9",400:"#9fa1a1",500:"#87898a",600:"#6e7173",700:"#565a5b",800:"#3e4244",900:"#262b2c",950:"#0e1315"}},{name:"ocean",palette:{0:"#ffffff",50:"#fbfcfc",100:"#F7F9F8",200:"#EFF3F2",300:"#DADEDD",400:"#B1B7B6",500:"#828787",600:"#5F7274",700:"#415B61",800:"#29444E",900:"#183240",950:"#0c1920"}}]);function C(){const c=f.value.find(l=>l.name===t.primary);return c.name==="noir"?{semantic:{primary:{50:"{surface.50}",100:"{surface.100}",200:"{surface.200}",300:"{surface.300}",400:"{surface.400}",500:"{surface.500}",600:"{surface.600}",700:"{surface.700}",800:"{surface.800}",900:"{surface.900}",950:"{surface.950}"},colorScheme:{light:{primary:{color:"{primary.950}",contrastColor:"#ffffff",hoverColor:"{primary.800}",activeColor:"{primary.700}"},highlight:{background:"{primary.950}",focusBackground:"{primary.700}",color:"#ffffff",focusColor:"#ffffff"}},dark:{primary:{color:"{primary.50}",contrastColor:"{primary.950}",hoverColor:"{primary.200}",activeColor:"{primary.300}"},highlight:{background:"{primary.50}",focusBackground:"{primary.300}",color:"{primary.950}",focusColor:"{primary.950}"}}}}}:{semantic:{primary:c.palette,colorScheme:{light:{primary:{color:"{primary.500}",contrastColor:"#ffffff",hoverColor:"{primary.600}",activeColor:"{primary.700}"},highlight:{background:"{primary.50}",focusBackground:"{primary.100}",color:"{primary.700}",focusColor:"{primary.800}"}},dark:{primary:{color:"{primary.400}",contrastColor:"{surface.900}",hoverColor:"{primary.300}",activeColor:"{primary.200}"},highlight:{background:"color-mix(in srgb, {primary.400}, transparent 84%)",focusBackground:"color-mix(in srgb, {primary.400}, transparent 76%)",color:"rgba(255,255,255,.87)",focusColor:"rgba(255,255,255,.87)"}}}}}}function V(c,l){c==="primary"?t.primary=l.name:c==="surface"&&(t.surface=l.name),q(c,l)}function q(c,l){c==="primary"?ne(C()):c==="surface"&&ae(l.palette)}function U(){var v;t.preset=d.value;const c=a[d.value],l=(v=p.value.find(i=>i.name===t.surface))==null?void 0:v.palette;oe().preset(c).preset(C()).surfacePalette(l).use({useDefaultOptions:!0})}function H(){t.menuMode=s.value}return(c,l)=>{const v=N;return b(),g("div",Le,[u("div",Pe,[u("div",null,[l[2]||(l[2]=u("span",{class:"text-sm text-muted-color font-semibold"},"Primary",-1)),u("div",Ve,[(b(!0),g(O,null,L(f.value,i=>(b(),g("button",{key:i.name,type:"button",title:i.name,onClick:Q=>V("primary",i),class:w(["border-none w-5 h-5 rounded-full p-0 cursor-pointer outline-none outline-offset-1",{"outline-primary":h(t).primary===i.name}]),style:A({backgroundColor:`${i.name==="noir"?"var(--text-color)":i.palette[500]}`})},null,14,Te))),128))])]),u("div",null,[l[3]||(l[3]=u("span",{class:"text-sm text-muted-color font-semibold"},"Surface",-1)),u("div",Ae,[(b(!0),g(O,null,L(p.value,i=>(b(),g("button",{key:i.name,type:"button",title:i.name,onClick:Q=>V("surface",i),class:w(["border-none w-5 h-5 rounded-full p-0 cursor-pointer outline-none outline-offset-1",{"outline-primary":h(t).surface?h(t).surface===i.name:h(o)?i.name==="zinc":i.name==="slate"}]),style:A({backgroundColor:`${i.palette[500]}`})},null,14,De))),128))])]),u("div",$e,[l[4]||(l[4]=u("span",{class:"text-sm text-muted-color font-semibold"},"Presets",-1)),k(v,{modelValue:d.value,"onUpdate:modelValue":l[0]||(l[0]=i=>d.value=i),onChange:U,options:n.value,allowEmpty:!1},null,8,["modelValue","options"])]),u("div",ze,[l[5]||(l[5]=u("span",{class:"text-sm text-muted-color font-semibold"},"Menu Mode",-1)),k(v,{modelValue:s.value,"onUpdate:modelValue":l[1]||(l[1]=i=>s.value=i),onChange:H,options:r.value,allowEmpty:!1,optionLabel:"label",optionValue:"value"},null,8,["modelValue","options"])])])])}}},Ie={class:"fixed flex gap-4 top-8 right-8"},Ee={class:"relative"},Ne={__name:"FloatingConfigurator",setup(e){const{toggleDarkMode:t,isDarkTheme:o}=K();return(a,d)=>{const n=re,s=W;return b(),g("div",Ie,[k(n,{type:"button",onClick:h(t),rounded:"",icon:h(o)?"pi pi-moon":"pi pi-sun",severity:"secondary"},null,8,["onClick","icon"]),u("div",Ee,[I(k(n,{icon:"pi pi-palette",type:"button",rounded:""},null,512),[[s,{selector:"@next",enterFromClass:"hidden",enterActiveClass:"animate-scalein",leaveToClass:"hidden",leaveActiveClass:"animate-fadeout",hideOnOutsideClick:!0}]]),k(Fe)])])}}};export{Ne as _};
