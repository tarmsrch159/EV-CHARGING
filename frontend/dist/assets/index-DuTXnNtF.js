import{P as l,B as u,f as g,R as p,c as i,a as s,I as y,z as c,Q as f,m as o,X as b,b as m,t as v}from"./index-DS3rIZVd.js";var k=l`
    .p-tag {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: dt('tag.primary.background');
        color: dt('tag.primary.color');
        font-size: dt('tag.font.size');
        font-weight: dt('tag.font.weight');
        padding: dt('tag.padding');
        border-radius: dt('tag.border.radius');
        gap: dt('tag.gap');
    }

    .p-tag-icon {
        font-size: dt('tag.icon.size');
        width: dt('tag.icon.size');
        height: dt('tag.icon.size');
    }

    .p-tag-rounded {
        border-radius: dt('tag.rounded.border.radius');
    }

    .p-tag-success {
        background: dt('tag.success.background');
        color: dt('tag.success.color');
    }

    .p-tag-info {
        background: dt('tag.info.background');
        color: dt('tag.info.color');
    }

    .p-tag-warn {
        background: dt('tag.warn.background');
        color: dt('tag.warn.color');
    }

    .p-tag-danger {
        background: dt('tag.danger.background');
        color: dt('tag.danger.color');
    }

    .p-tag-secondary {
        background: dt('tag.secondary.background');
        color: dt('tag.secondary.color');
    }

    .p-tag-contrast {
        background: dt('tag.contrast.background');
        color: dt('tag.contrast.color');
    }
`,h={root:function(e){var r=e.props;return["p-tag p-component",{"p-tag-info":r.severity==="info","p-tag-success":r.severity==="success","p-tag-warn":r.severity==="warn","p-tag-danger":r.severity==="danger","p-tag-secondary":r.severity==="secondary","p-tag-contrast":r.severity==="contrast","p-tag-rounded":r.rounded}]},icon:"p-tag-icon",label:"p-tag-label"},S=u.extend({name:"tag",style:k,classes:h}),w={name:"BaseTag",extends:g,props:{value:null,severity:null,rounded:Boolean,icon:String},style:S,provide:function(){return{$pcTag:this,$parentInstance:this}}};function a(t){"@babel/helpers - typeof";return a=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},a(t)}function P(t,e,r){return(e=$(e))in t?Object.defineProperty(t,e,{value:r,enumerable:!0,configurable:!0,writable:!0}):t[e]=r,t}function $(t){var e=B(t,"string");return a(e)=="symbol"?e:e+""}function B(t,e){if(a(t)!="object"||!t)return t;var r=t[Symbol.toPrimitive];if(r!==void 0){var n=r.call(t,e);if(a(n)!="object")return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(t)}var z={name:"Tag",extends:w,inheritAttrs:!1,computed:{dataP:function(){return p(P({rounded:this.rounded},this.severity,this.severity))}}},T=["data-p"];function j(t,e,r,n,N,d){return s(),i("span",o({class:t.cx("root"),"data-p":d.dataP},t.ptmi("root")),[t.$slots.icon?(s(),y(b(t.$slots.icon),o({key:0,class:t.cx("icon")},t.ptm("icon")),null,16,["class"])):t.icon?(s(),i("span",o({key:1,class:[t.cx("icon"),t.icon]},t.ptm("icon")),null,16)):c("",!0),t.value!=null||t.$slots.default?f(t.$slots,"default",{key:2},function(){return[m("span",o({class:t.cx("label")},t.ptm("label")),v(t.value),17)]}):c("",!0)],16,T)}z.render=j;export{z as s};
