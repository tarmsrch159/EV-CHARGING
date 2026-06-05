import{P as H,B as C,ag as $,ae as L,f as S,b1 as v,at as A,aq as E,V as B,a7 as P,m as l,ac as O,c as u,a as c,b as f,G as h,z as p,Q as m,I as g,X as y,F as w,N as I,t as N,aL as K,ap as V,w as j,n as F}from"./index-DS3rIZVd.js";import{s as z}from"./index-CF6vjrOA.js";var R=H`
    .p-tabview-tablist-container {
        position: relative;
    }

    .p-tabview-scrollable > .p-tabview-tablist-container {
        overflow: hidden;
    }

    .p-tabview-tablist-scroll-container {
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        scrollbar-width: none;
        overscroll-behavior: contain auto;
    }

    .p-tabview-tablist-scroll-container::-webkit-scrollbar {
        display: none;
    }

    .p-tabview-tablist {
        display: flex;
        margin: 0;
        padding: 0;
        list-style-type: none;
        flex: 1 1 auto;
        background: dt('tabview.tab.list.background');
        border: 1px solid dt('tabview.tab.list.border.color');
        border-width: 0 0 1px 0;
        position: relative;
    }

    .p-tabview-tab-header {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        text-decoration: none;
        position: relative;
        overflow: hidden;
        border-style: solid;
        border-width: 0 0 1px 0;
        border-color: transparent transparent dt('tabview.tab.border.color') transparent;
        color: dt('tabview.tab.color');
        padding: 1rem 1.125rem;
        font-weight: 600;
        border-top-right-radius: dt('border.radius.md');
        border-top-left-radius: dt('border.radius.md');
        transition:
            color dt('tabview.transition.duration'),
            outline-color dt('tabview.transition.duration');
        margin: 0 0 -1px 0;
        outline-color: transparent;
    }

    .p-tabview-tablist-item:not(.p-disabled) .p-tabview-tab-header:focus-visible {
        outline: dt('focus.ring.width') dt('focus.ring.style') dt('focus.ring.color');
        outline-offset: -1px;
    }

    .p-tabview-tablist-item:not(.p-highlight):not(.p-disabled):hover > .p-tabview-tab-header {
        color: dt('tabview.tab.hover.color');
    }

    .p-tabview-tablist-item.p-highlight > .p-tabview-tab-header {
        color: dt('tabview.tab.active.color');
    }

    .p-tabview-tab-title {
        line-height: 1;
        white-space: nowrap;
    }

    .p-tabview-next-button,
    .p-tabview-prev-button {
        position: absolute;
        top: 0;
        margin: 0;
        padding: 0;
        z-index: 2;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: dt('tabview.nav.button.background');
        color: dt('tabview.nav.button.color');
        width: 2.5rem;
        border-radius: 0;
        outline-color: transparent;
        transition:
            color dt('tabview.transition.duration'),
            outline-color dt('tabview.transition.duration');
        box-shadow: dt('tabview.nav.button.shadow');
        border: none;
        cursor: pointer;
        user-select: none;
    }

    .p-tabview-next-button:focus-visible,
    .p-tabview-prev-button:focus-visible {
        outline: dt('focus.ring.width') dt('focus.ring.style') dt('focus.ring.color');
        outline-offset: dt('focus.ring.offset');
    }

    .p-tabview-next-button:hover,
    .p-tabview-prev-button:hover {
        color: dt('tabview.nav.button.hover.color');
    }

    .p-tabview-prev-button {
        left: 0;
    }

    .p-tabview-next-button {
        right: 0;
    }

    .p-tabview-panels {
        background: dt('tabview.tab.panel.background');
        color: dt('tabview.tab.panel.color');
        padding: 0.875rem 1.125rem 1.125rem 1.125rem;
    }

    .p-tabview-ink-bar {
        z-index: 1;
        display: block;
        position: absolute;
        bottom: -1px;
        height: 1px;
        background: dt('tabview.tab.active.border.color');
        transition: 250ms cubic-bezier(0.35, 0, 0.25, 1);
    }
`,W={root:function(e){var a=e.props;return["p-tabview p-component",{"p-tabview-scrollable":a.scrollable}]},navContainer:"p-tabview-tablist-container",prevButton:"p-tabview-prev-button",navContent:"p-tabview-tablist-scroll-container",nav:"p-tabview-tablist",tab:{header:function(e){var a=e.instance,n=e.tab,o=e.index;return["p-tabview-tablist-item",a.getTabProp(n,"headerClass"),{"p-tabview-tablist-item-active":a.d_activeIndex===o,"p-disabled":a.getTabProp(n,"disabled")}]},headerAction:"p-tabview-tab-header",headerTitle:"p-tabview-tab-title",content:function(e){var a=e.instance,n=e.tab;return["p-tabview-panel",a.getTabProp(n,"contentClass")]}},inkbar:"p-tabview-ink-bar",nextButton:"p-tabview-next-button",panelContainer:"p-tabview-panels"},U=C.extend({name:"tabview",style:R,classes:W}),q={name:"BaseTabView",extends:S,props:{activeIndex:{type:Number,default:0},lazy:{type:Boolean,default:!1},scrollable:{type:Boolean,default:!1},tabindex:{type:Number,default:0},selectOnFocus:{type:Boolean,default:!1},prevButtonProps:{type:null,default:null},nextButtonProps:{type:null,default:null},prevIcon:{type:String,default:void 0},nextIcon:{type:String,default:void 0}},style:U,provide:function(){return{$pcTabs:void 0,$pcTabView:this,$parentInstance:this}}},G={name:"TabView",extends:q,inheritAttrs:!1,emits:["update:activeIndex","tab-change","tab-click"],data:function(){return{d_activeIndex:this.activeIndex,isPrevButtonDisabled:!0,isNextButtonDisabled:!1}},watch:{activeIndex:function(e){this.d_activeIndex=e,this.scrollInView({index:e})}},mounted:function(){console.warn("Deprecated since v4. Use Tabs component instead."),this.updateInkBar(),this.scrollable&&this.updateButtonState()},updated:function(){this.updateInkBar(),this.scrollable&&this.updateButtonState()},methods:{isTabPanel:function(e){return e.type.name==="TabPanel"},isTabActive:function(e){return this.d_activeIndex===e},getTabProp:function(e,a){return e.props?e.props[a]:void 0},getKey:function(e,a){return this.getTabProp(e,"header")||a},getTabHeaderActionId:function(e){return"".concat(this.$id,"_").concat(e,"_header_action")},getTabContentId:function(e){return"".concat(this.$id,"_").concat(e,"_content")},getTabPT:function(e,a,n){var o=this.tabs.length,r={props:e.props,parent:{instance:this,props:this.$props,state:this.$data},context:{index:n,count:o,first:n===0,last:n===o-1,active:this.isTabActive(n)}};return l(this.ptm("tabpanel.".concat(a),{tabpanel:r}),this.ptm("tabpanel.".concat(a),r),this.ptmo(this.getTabProp(e,"pt"),a,r))},onScroll:function(e){this.scrollable&&this.updateButtonState(),e.preventDefault()},onPrevButtonClick:function(){var e=this.$refs.content,a=v(e),n=e.scrollLeft-a;e.scrollLeft=n<=0?0:n},onNextButtonClick:function(){var e=this.$refs.content,a=v(e)-this.getVisibleButtonWidths(),n=e.scrollLeft+a,o=e.scrollWidth-a;e.scrollLeft=n>=o?o:n},onTabClick:function(e,a,n){this.changeActiveIndex(e,a,n),this.$emit("tab-click",{originalEvent:e,index:n})},onTabKeyDown:function(e,a,n){switch(e.code){case"ArrowLeft":this.onTabArrowLeftKey(e);break;case"ArrowRight":this.onTabArrowRightKey(e);break;case"Home":this.onTabHomeKey(e);break;case"End":this.onTabEndKey(e);break;case"PageDown":this.onPageDownKey(e);break;case"PageUp":this.onPageUpKey(e);break;case"Enter":case"NumpadEnter":case"Space":this.onTabEnterKey(e,a,n);break}},onTabArrowRightKey:function(e){var a=this.findNextHeaderAction(e.target.parentElement);a?this.changeFocusedTab(e,a):this.onTabHomeKey(e),e.preventDefault()},onTabArrowLeftKey:function(e){var a=this.findPrevHeaderAction(e.target.parentElement);a?this.changeFocusedTab(e,a):this.onTabEndKey(e),e.preventDefault()},onTabHomeKey:function(e){var a=this.findFirstHeaderAction();this.changeFocusedTab(e,a),e.preventDefault()},onTabEndKey:function(e){var a=this.findLastHeaderAction();this.changeFocusedTab(e,a),e.preventDefault()},onPageDownKey:function(e){this.scrollInView({index:this.$refs.nav.children.length-2}),e.preventDefault()},onPageUpKey:function(e){this.scrollInView({index:0}),e.preventDefault()},onTabEnterKey:function(e,a,n){this.changeActiveIndex(e,a,n),e.preventDefault()},findNextHeaderAction:function(e){var a=arguments.length>1&&arguments[1]!==void 0?arguments[1]:!1,n=a?e:e.nextElementSibling;return n?P(n,"data-p-disabled")||P(n,"data-pc-section")==="inkbar"?this.findNextHeaderAction(n):B(n,'[data-pc-section="headeraction"]'):null},findPrevHeaderAction:function(e){var a=arguments.length>1&&arguments[1]!==void 0?arguments[1]:!1,n=a?e:e.previousElementSibling;return n?P(n,"data-p-disabled")||P(n,"data-pc-section")==="inkbar"?this.findPrevHeaderAction(n):B(n,'[data-pc-section="headeraction"]'):null},findFirstHeaderAction:function(){return this.findNextHeaderAction(this.$refs.nav.firstElementChild,!0)},findLastHeaderAction:function(){return this.findPrevHeaderAction(this.$refs.nav.lastElementChild,!0)},changeActiveIndex:function(e,a,n){!this.getTabProp(a,"disabled")&&this.d_activeIndex!==n&&(this.d_activeIndex=n,this.$emit("update:activeIndex",n),this.$emit("tab-change",{originalEvent:e,index:n}),this.scrollInView({index:n}))},changeFocusedTab:function(e,a){if(a&&(E(a),this.scrollInView({element:a}),this.selectOnFocus)){var n=parseInt(a.parentElement.dataset.pcIndex,10),o=this.tabs[n];this.changeActiveIndex(e,o,n)}},scrollInView:function(e){var a=e.element,n=e.index,o=n===void 0?-1:n,r=a||this.$refs.nav.children[o];r&&r.scrollIntoView&&r.scrollIntoView({block:"nearest"})},updateInkBar:function(){var e=this.$refs.nav.children[this.d_activeIndex];this.$refs.inkbar.style.width=v(e)+"px",this.$refs.inkbar.style.left=A(e).left-A(this.$refs.nav).left+"px"},updateButtonState:function(){var e=this.$refs.content,a=e.scrollLeft,n=e.scrollWidth,o=v(e);this.isPrevButtonDisabled=a===0,this.isNextButtonDisabled=parseInt(a)===n-o},getVisibleButtonWidths:function(){var e=this.$refs,a=e.prevBtn,n=e.nextBtn;return[a,n].reduce(function(o,r){return r?o+v(r):o},0)}},computed:{tabs:function(){var e=this;return this.$slots.default().reduce(function(a,n){return e.isTabPanel(n)?a.push(n):n.children&&n.children instanceof Array&&n.children.forEach(function(o){e.isTabPanel(o)&&a.push(o)}),a},[])},prevButtonAriaLabel:function(){return this.$primevue.config.locale.aria?this.$primevue.config.locale.aria.previous:void 0},nextButtonAriaLabel:function(){return this.$primevue.config.locale.aria?this.$primevue.config.locale.aria.next:void 0}},directives:{ripple:L},components:{ChevronLeftIcon:z,ChevronRightIcon:$}};function T(t){"@babel/helpers - typeof";return T=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(e){return typeof e}:function(e){return e&&typeof Symbol=="function"&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e},T(t)}function x(t,e){var a=Object.keys(t);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(t);e&&(n=n.filter(function(o){return Object.getOwnPropertyDescriptor(t,o).enumerable})),a.push.apply(a,n)}return a}function d(t){for(var e=1;e<arguments.length;e++){var a=arguments[e]!=null?arguments[e]:{};e%2?x(Object(a),!0).forEach(function(n){M(t,n,a[n])}):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(a)):x(Object(a)).forEach(function(n){Object.defineProperty(t,n,Object.getOwnPropertyDescriptor(a,n))})}return t}function M(t,e,a){return(e=Q(e))in t?Object.defineProperty(t,e,{value:a,enumerable:!0,configurable:!0,writable:!0}):t[e]=a,t}function Q(t){var e=X(t,"string");return T(e)=="symbol"?e:e+""}function X(t,e){if(T(t)!="object"||!t)return t;var a=t[Symbol.toPrimitive];if(a!==void 0){var n=a.call(t,e);if(T(n)!="object")return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return(e==="string"?String:Number)(t)}var J=["tabindex","aria-label"],Y=["data-p-active","data-p-disabled","data-pc-index"],Z=["id","tabindex","aria-disabled","aria-selected","aria-controls","onClick","onKeydown"],_=["tabindex","aria-label"],ee=["id","aria-labelledby","data-pc-index","data-p-active"];function te(t,e,a,n,o,r){var b=O("ripple");return c(),u("div",l({class:t.cx("root"),role:"tablist"},t.ptmi("root")),[f("div",l({class:t.cx("navContainer")},t.ptm("navContainer")),[t.scrollable&&!o.isPrevButtonDisabled?h((c(),u("button",l({key:0,ref:"prevBtn",type:"button",class:t.cx("prevButton"),tabindex:t.tabindex,"aria-label":r.prevButtonAriaLabel,onClick:e[0]||(e[0]=function(){return r.onPrevButtonClick&&r.onPrevButtonClick.apply(r,arguments)})},d(d({},t.prevButtonProps),t.ptm("prevButton")),{"data-pc-group-section":"navbutton"}),[m(t.$slots,"previcon",{},function(){return[(c(),g(y(t.prevIcon?"span":"ChevronLeftIcon"),l({"aria-hidden":"true",class:t.prevIcon},t.ptm("prevIcon")),null,16,["class"]))]})],16,J)),[[b]]):p("",!0),f("div",l({ref:"content",class:t.cx("navContent"),onScroll:e[1]||(e[1]=function(){return r.onScroll&&r.onScroll.apply(r,arguments)})},t.ptm("navContent")),[f("ul",l({ref:"nav",class:t.cx("nav")},t.ptm("nav")),[(c(!0),u(w,null,I(r.tabs,function(i,s){return c(),u("li",l({key:r.getKey(i,s),style:r.getTabProp(i,"headerStyle"),class:t.cx("tab.header",{tab:i,index:s}),role:"presentation"},{ref_for:!0},d(d(d({},r.getTabProp(i,"headerProps")),r.getTabPT(i,"root",s)),r.getTabPT(i,"header",s)),{"data-pc-name":"tabpanel","data-p-active":o.d_activeIndex===s,"data-p-disabled":r.getTabProp(i,"disabled"),"data-pc-index":s}),[h((c(),u("a",l({id:r.getTabHeaderActionId(s),class:t.cx("tab.headerAction"),tabindex:r.getTabProp(i,"disabled")||!r.isTabActive(s)?-1:t.tabindex,role:"tab","aria-disabled":r.getTabProp(i,"disabled"),"aria-selected":r.isTabActive(s),"aria-controls":r.getTabContentId(s),onClick:function(k){return r.onTabClick(k,i,s)},onKeydown:function(k){return r.onTabKeyDown(k,i,s)}},{ref_for:!0},d(d({},r.getTabProp(i,"headerActionProps")),r.getTabPT(i,"headerAction",s))),[i.props&&i.props.header?(c(),u("span",l({key:0,class:t.cx("tab.headerTitle")},{ref_for:!0},r.getTabPT(i,"headerTitle",s)),N(i.props.header),17)):p("",!0),i.children&&i.children.header?(c(),g(y(i.children.header),{key:1})):p("",!0)],16,Z)),[[b]])],16,Y)}),128)),f("li",l({ref:"inkbar",class:t.cx("inkbar"),role:"presentation","aria-hidden":"true"},t.ptm("inkbar")),null,16)],16)],16),t.scrollable&&!o.isNextButtonDisabled?h((c(),u("button",l({key:1,ref:"nextBtn",type:"button",class:t.cx("nextButton"),tabindex:t.tabindex,"aria-label":r.nextButtonAriaLabel,onClick:e[2]||(e[2]=function(){return r.onNextButtonClick&&r.onNextButtonClick.apply(r,arguments)})},d(d({},t.nextButtonProps),t.ptm("nextButton")),{"data-pc-group-section":"navbutton"}),[m(t.$slots,"nexticon",{},function(){return[(c(),g(y(t.nextIcon?"span":"ChevronRightIcon"),l({"aria-hidden":"true",class:t.nextIcon},t.ptm("nextIcon")),null,16,["class"]))]})],16,_)),[[b]]):p("",!0)],16),f("div",l({class:t.cx("panelContainer")},t.ptm("panelContainer")),[(c(!0),u(w,null,I(r.tabs,function(i,s){return c(),u(w,{key:r.getKey(i,s)},[!t.lazy||r.isTabActive(s)?h((c(),u("div",l({key:0,id:r.getTabContentId(s),style:r.getTabProp(i,"contentStyle"),class:t.cx("tab.content",{tab:i}),role:"tabpanel","aria-labelledby":r.getTabHeaderActionId(s)},{ref_for:!0},d(d(d({},r.getTabProp(i,"contentProps")),r.getTabPT(i,"root",s)),r.getTabPT(i,"content",s)),{"data-pc-name":"tabpanel","data-pc-index":s,"data-p-active":o.d_activeIndex===s}),[(c(),g(y(i)))],16,ee)),[[K,t.lazy?!0:r.isTabActive(s)]]):p("",!0)],64)}),128))],16)],16)}G.render=te;var ae={root:function(e){var a=e.instance;return["p-tabpanel",{"p-tabpanel-active":a.active}]}},ne=C.extend({name:"tabpanel",classes:ae}),re={name:"BaseTabPanel",extends:S,props:{value:{type:[String,Number],default:void 0},as:{type:[String,Object],default:"DIV"},asChild:{type:Boolean,default:!1},header:null,headerStyle:null,headerClass:null,headerProps:null,headerActionProps:null,contentStyle:null,contentClass:null,contentProps:null,disabled:Boolean},style:ne,provide:function(){return{$pcTabPanel:this,$parentInstance:this}}},ie={name:"TabPanel",extends:re,inheritAttrs:!1,inject:["$pcTabs"],computed:{active:function(){var e;return V((e=this.$pcTabs)===null||e===void 0?void 0:e.d_value,this.value)},id:function(){var e;return"".concat((e=this.$pcTabs)===null||e===void 0?void 0:e.$id,"_tabpanel_").concat(this.value)},ariaLabelledby:function(){var e;return"".concat((e=this.$pcTabs)===null||e===void 0?void 0:e.$id,"_tab_").concat(this.value)},attrs:function(){return l(this.a11yAttrs,this.ptmi("root",this.ptParams))},a11yAttrs:function(){var e;return{id:this.id,tabindex:(e=this.$pcTabs)===null||e===void 0?void 0:e.tabindex,role:"tabpanel","aria-labelledby":this.ariaLabelledby,"data-pc-name":"tabpanel","data-p-active":this.active}},ptParams:function(){return{context:{active:this.active}}}}};function oe(t,e,a,n,o,r){var b,i;return r.$pcTabs?(c(),u(w,{key:1},[t.asChild?m(t.$slots,"default",{key:1,class:F(t.cx("root")),active:r.active,a11yAttrs:r.a11yAttrs}):(c(),u(w,{key:0},[!((b=r.$pcTabs)!==null&&b!==void 0&&b.lazy)||r.active?h((c(),g(y(t.as),l({key:0,class:t.cx("root")},r.attrs),{default:j(function(){return[m(t.$slots,"default")]}),_:3},16,["class"])),[[K,(i=r.$pcTabs)!==null&&i!==void 0&&i.lazy?!0:r.active]]):p("",!0)],64))],64)):m(t.$slots,"default",{key:0})}ie.render=oe;export{ie as a,G as s};
