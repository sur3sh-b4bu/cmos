import{b as C,c as K}from"./chunk-EW2O3VLA.js";import{a as Nt}from"./chunk-5J6HXFG6.js";import{h as Ct,n as Rt,p as Ot,q as Yt}from"./chunk-BQL5JC3H.js";import{a as Pt}from"./chunk-4ODNQHB2.js";import{a as Bt,b as Ht}from"./chunk-G5UTFPRR.js";import{B as Tt,h as kt,j as je,n as We,o as At,p as Mt,q as St,r as Vt,u as Et,v as xt,w as It,y as Ft}from"./chunk-OTJ7C2SU.js";import{C as yt,K as Ke,N as wt,Q as ne,R as ie,S as Me,c as ze,e as gt,i as ft,q as bt,s as Dt,t as H,w as Ae}from"./chunk-BLAZBUA6.js";import{A as Lt,q as te,r as ke,u as ae,v as vt}from"./chunk-OKKJV2TA.js";import{$ as o,A as at,Bb as ge,Cb as fe,Cc as _t,Db as _,Eb as l,F as nt,Fb as p,Gb as D,Hb as S,Ib as V,Ic as R,Jb as ct,Lc as B,Nb as ee,O as he,Ob as L,Rb as m,Sb as pt,Tb as u,Ub as Ne,V as Te,Va as d,Vb as Be,W as ue,Wb as ht,X as it,Xb as N,Yb as E,Z as Re,Zb as x,_ as rt,_a as Ye,a as M,bb as Pe,cc as be,db as ot,dc as I,e as O,eb as dt,ec as De,fa as v,fc as g,ga as y,gc as T,ha as F,hc as z,ia as Y,ib as k,ic as He,ja as me,jb as lt,ka as st,kb as $,kc as ve,l as ce,lc as ye,mc as Ce,na as c,nb as X,nc as we,oa as Oe,ob as Le,sa as h,sc as ut,tc as mt,wa as P,wb as f,xa as _e,xb as Z,yb as J,z as pe,za as U}from"./chunk-A3OL4LEI.js";var oa=["mat-calendar-body",""];function da(i,s){return this._trackRow(s)}var Ut=(i,s)=>s.id;function la(i,s){if(i&1&&(S(0,"tr",0)(1,"td",3),g(2),V()()),i&2){let e=u();d(),be("padding-top",e._cellPadding)("padding-bottom",e._cellPadding),f("colspan",e.numCols),d(),z(" ",e.label," ")}}function ca(i,s){if(i&1&&(S(0,"td",3),g(1),V()),i&2){let e=u(2);be("padding-top",e._cellPadding)("padding-bottom",e._cellPadding),f("colspan",e._firstRowOffset),d(),z(" ",e._firstRowOffset>=e.labelMinRequiredCells?e.label:""," ")}}function pa(i,s){if(i&1){let e=ee();S(0,"td",6)(1,"button",7),pt("click",function(t){let n=v(e).$implicit,r=u(2);return y(r._cellClicked(n,t))})("focus",function(t){let n=v(e).$implicit,r=u(2);return y(r._emitActiveDateChange(n,t))}),S(2,"span",8),g(3),V(),ct(4,"span",9),V()()}if(i&2){let e=s.$implicit,a=s.$index,t=u().$index,n=u();be("width",n._cellWidth)("padding-top",n._cellPadding)("padding-bottom",n._cellPadding),f("data-mat-row",t)("data-mat-col",a),d(),De(e.cssClasses),I("mat-calendar-body-disabled",!e.enabled)("mat-calendar-body-active",n._isActiveCell(t,a))("mat-calendar-body-range-start",n._isRangeStart(e.compareValue))("mat-calendar-body-range-end",n._isRangeEnd(e.compareValue))("mat-calendar-body-in-range",n._isInRange(e.compareValue))("mat-calendar-body-comparison-bridge-start",n._isComparisonBridgeStart(e.compareValue,t,a))("mat-calendar-body-comparison-bridge-end",n._isComparisonBridgeEnd(e.compareValue,t,a))("mat-calendar-body-comparison-start",n._isComparisonStart(e.compareValue))("mat-calendar-body-comparison-end",n._isComparisonEnd(e.compareValue))("mat-calendar-body-in-comparison-range",n._isInComparisonRange(e.compareValue))("mat-calendar-body-preview-start",n._isPreviewStart(e.compareValue))("mat-calendar-body-preview-end",n._isPreviewEnd(e.compareValue))("mat-calendar-body-in-preview",n._isInPreview(e.compareValue)),L("tabIndex",n._isActiveCell(t,a)?0:-1),f("aria-label",e.ariaLabel)("aria-disabled",!e.enabled||null)("aria-pressed",n._isSelected(e.compareValue))("aria-current",n.todayValue===e.compareValue?"date":null)("aria-describedby",n._getDescribedby(e.compareValue)),d(),I("mat-calendar-body-selected",n._isSelected(e.compareValue))("mat-calendar-body-comparison-identical",n._isComparisonIdentical(e.compareValue))("mat-calendar-body-today",n.todayValue===e.compareValue),d(),z(" ",e.displayValue," ")}}function ha(i,s){if(i&1&&(S(0,"tr",1),Z(1,ca,2,6,"td",4),ge(2,pa,5,49,"td",5,Ut),V()),i&2){let e=s.$implicit,a=s.$index,t=u();d(),J(a===0&&t._firstRowOffset?1:-1),d(),fe(e)}}function ua(i,s){if(i&1&&(l(0,"th",2)(1,"span",6),g(2),p(),l(3,"span",3),g(4),p()()),i&2){let e=s.$implicit;d(2),T(e.long),d(2),T(e.narrow)}}var ma=["*"];function _a(i,s){}function ga(i,s){if(i&1){let e=ee();l(0,"mat-month-view",4),Ce("activeDateChange",function(t){v(e);let n=u();return ye(n.activeDate,t)||(n.activeDate=t),y(t)}),m("_userSelection",function(t){v(e);let n=u();return y(n._dateSelected(t))})("dragStarted",function(t){v(e);let n=u();return y(n._dragStarted(t))})("dragEnded",function(t){v(e);let n=u();return y(n._dragEnded(t))}),p()}if(i&2){let e=u();ve("activeDate",e.activeDate),_("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)("comparisonStart",e.comparisonStart)("comparisonEnd",e.comparisonEnd)("startDateAccessibleName",e.startDateAccessibleName)("endDateAccessibleName",e.endDateAccessibleName)("activeDrag",e._activeDrag)}}function fa(i,s){if(i&1){let e=ee();l(0,"mat-year-view",5),Ce("activeDateChange",function(t){v(e);let n=u();return ye(n.activeDate,t)||(n.activeDate=t),y(t)}),m("monthSelected",function(t){v(e);let n=u();return y(n._monthSelectedInYearView(t))})("selectedChange",function(t){v(e);let n=u();return y(n._goToDateInView(t,"month"))}),p()}if(i&2){let e=u();ve("activeDate",e.activeDate),_("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)}}function ba(i,s){if(i&1){let e=ee();l(0,"mat-multi-year-view",6),Ce("activeDateChange",function(t){v(e);let n=u();return ye(n.activeDate,t)||(n.activeDate=t),y(t)}),m("yearSelected",function(t){v(e);let n=u();return y(n._yearSelectedInMultiYearView(t))})("selectedChange",function(t){v(e);let n=u();return y(n._goToDateInView(t,"year"))}),p()}if(i&2){let e=u();ve("activeDate",e.activeDate),_("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)}}function Da(i,s){}var va=["button"],ya=[[["","matDatepickerToggleIcon",""]]],Ca=["[matDatepickerToggleIcon]"];function wa(i,s){i&1&&(F(),l(0,"svg",2),D(1,"path",3),p())}var G=(()=>{class i{changes=new O;calendarLabel="Calendar";openCalendarLabel="Open calendar";closeCalendarLabel="Close calendar";prevMonthLabel="Previous month";nextMonthLabel="Next month";prevYearLabel="Previous year";nextYearLabel="Next year";prevMultiYearLabel="Previous 24 years";nextMultiYearLabel="Next 24 years";switchToMonthViewLabel="Choose date";switchToMultiYearViewLabel="Choose month and year";startDateLabel="Start date";endDateLabel="End date";comparisonDateLabel="Comparison range";formatYearRange(e,a){return`${e} \u2013 ${a}`}formatYearRangeLabel(e,a){return`${e} to ${a}`}static \u0275fac=function(a){return new(a||i)};static \u0275prov=ue({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),ka=0,oe=class{value;displayValue;ariaLabel;enabled;compareValue;rawValue;id=ka++;cssClasses;constructor(s,e,a,t,n,r=s,b){this.value=s,this.displayValue=e,this.ariaLabel=a,this.enabled=t,this.compareValue=r,this.rawValue=b,this.cssClasses=n instanceof Set?Array.from(n):n}},Aa={passive:!1,capture:!0},Se={passive:!0,capture:!0},zt={passive:!0},Q=(()=>{class i{_elementRef=o(U);_ngZone=o(Oe);_platform=o(gt);_intl=o(G);_eventCleanups;_skipNextFocus=!1;_focusActiveCellAfterViewChecked=!1;label;rows;todayValue;startValue;endValue;labelMinRequiredCells;numCols=7;activeCell=0;ngAfterViewChecked(){this._focusActiveCellAfterViewChecked&&(this._focusActiveCell(),this._focusActiveCellAfterViewChecked=!1)}isRange=!1;cellAspectRatio=1;comparisonStart=null;comparisonEnd=null;previewStart=null;previewEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;selectedValueChange=new c;previewChange=new c;activeDateChange=new c;dragStarted=new c;dragEnded=new c;_firstRowOffset;_cellPadding;_cellWidth;_startDateLabelId;_endDateLabelId;_comparisonStartDateLabelId;_comparisonEndDateLabelId;_didDragSinceMouseDown=!1;_injector=o(me);comparisonDateAccessibleName=this._intl.comparisonDateLabel;_trackRow=e=>e;constructor(){let e=o(Pe),a=o(Ae);this._startDateLabelId=a.getId("mat-calendar-body-start-"),this._endDateLabelId=a.getId("mat-calendar-body-end-"),this._comparisonStartDateLabelId=a.getId("mat-calendar-body-comparison-start-"),this._comparisonEndDateLabelId=a.getId("mat-calendar-body-comparison-end-"),o(te).load(wt),this._ngZone.runOutsideAngular(()=>{let t=this._elementRef.nativeElement,n=[e.listen(t,"touchmove",this._touchmoveHandler,Aa),e.listen(t,"mouseenter",this._enterHandler,Se),e.listen(t,"focus",this._enterHandler,Se),e.listen(t,"mouseleave",this._leaveHandler,Se),e.listen(t,"blur",this._leaveHandler,Se),e.listen(t,"mousedown",this._mousedownHandler,zt),e.listen(t,"touchstart",this._mousedownHandler,zt)];this._platform.isBrowser&&n.push(e.listen("window","mouseup",this._mouseupHandler),e.listen("window","touchend",this._touchendHandler)),this._eventCleanups=n})}_cellClicked(e,a){this._didDragSinceMouseDown||e.enabled&&this.selectedValueChange.emit({value:e.value,event:a})}_emitActiveDateChange(e,a){e.enabled&&this.activeDateChange.emit({value:e.value,event:a})}_isSelected(e){return this.startValue===e||this.endValue===e}ngOnChanges(e){let a=e.numCols,{rows:t,numCols:n}=this;(e.rows||a)&&(this._firstRowOffset=t&&t.length&&t[0].length?n-t[0].length:0),(e.cellAspectRatio||a||!this._cellPadding)&&(this._cellPadding=`${50*this.cellAspectRatio/n}%`),(a||!this._cellWidth)&&(this._cellWidth=`${100/n}%`)}ngOnDestroy(){this._eventCleanups.forEach(e=>e())}_isActiveCell(e,a){let t=e*this.numCols+a;return e&&(t-=this._firstRowOffset),t==this.activeCell}_focusActiveCell(e=!0){Ye(()=>{setTimeout(()=>{let a=this._elementRef.nativeElement.querySelector(".mat-calendar-body-active");a&&(e||(this._skipNextFocus=!0),a.focus())})},{injector:this._injector})}_scheduleFocusActiveCellAfterViewChecked(){this._focusActiveCellAfterViewChecked=!0}_isRangeStart(e){return Ge(e,this.startValue,this.endValue)}_isRangeEnd(e){return Ue(e,this.startValue,this.endValue)}_isInRange(e){return $e(e,this.startValue,this.endValue,this.isRange)}_isComparisonStart(e){return Ge(e,this.comparisonStart,this.comparisonEnd)}_isComparisonBridgeStart(e,a,t){if(!this._isComparisonStart(e)||this._isRangeStart(e)||!this._isInRange(e))return!1;let n=this.rows[a][t-1];if(!n){let r=this.rows[a-1];n=r&&r[r.length-1]}return n&&!this._isRangeEnd(n.compareValue)}_isComparisonBridgeEnd(e,a,t){if(!this._isComparisonEnd(e)||this._isRangeEnd(e)||!this._isInRange(e))return!1;let n=this.rows[a][t+1];if(!n){let r=this.rows[a+1];n=r&&r[0]}return n&&!this._isRangeStart(n.compareValue)}_isComparisonEnd(e){return Ue(e,this.comparisonStart,this.comparisonEnd)}_isInComparisonRange(e){return $e(e,this.comparisonStart,this.comparisonEnd,this.isRange)}_isComparisonIdentical(e){return this.comparisonStart===this.comparisonEnd&&e===this.comparisonStart}_isPreviewStart(e){return Ge(e,this.previewStart,this.previewEnd)}_isPreviewEnd(e){return Ue(e,this.previewStart,this.previewEnd)}_isInPreview(e){return $e(e,this.previewStart,this.previewEnd,this.isRange)}_getDescribedby(e){if(!this.isRange)return null;if(this.startValue===e&&this.endValue===e)return`${this._startDateLabelId} ${this._endDateLabelId}`;if(this.startValue===e)return this._startDateLabelId;if(this.endValue===e)return this._endDateLabelId;if(this.comparisonStart!==null&&this.comparisonEnd!==null){if(e===this.comparisonStart&&e===this.comparisonEnd)return`${this._comparisonStartDateLabelId} ${this._comparisonEndDateLabelId}`;if(e===this.comparisonStart)return this._comparisonStartDateLabelId;if(e===this.comparisonEnd)return this._comparisonEndDateLabelId}return null}_enterHandler=e=>{if(this._skipNextFocus&&e.type==="focus"){this._skipNextFocus=!1;return}if(e.target&&this.isRange){let a=this._getCellFromElement(e.target);a&&this._ngZone.run(()=>this.previewChange.emit({value:a.enabled?a:null,event:e}))}};_touchmoveHandler=e=>{if(!this.isRange)return;let a=Kt(e),t=a?this._getCellFromElement(a):null;a!==e.target&&(this._didDragSinceMouseDown=!0),Qe(e.target)&&e.preventDefault(),this._ngZone.run(()=>this.previewChange.emit({value:t?.enabled?t:null,event:e}))};_leaveHandler=e=>{this.previewEnd!==null&&this.isRange&&(e.type!=="blur"&&(this._didDragSinceMouseDown=!0),e.target&&this._getCellFromElement(e.target)&&!(e.relatedTarget&&this._getCellFromElement(e.relatedTarget))&&this._ngZone.run(()=>this.previewChange.emit({value:null,event:e})))};_mousedownHandler=e=>{if(!this.isRange)return;this._didDragSinceMouseDown=!1;let a=e.target&&this._getCellFromElement(e.target);!a||!this._isInRange(a.compareValue)||this._ngZone.run(()=>{this.dragStarted.emit({value:a.rawValue,event:e})})};_mouseupHandler=e=>{if(!this.isRange)return;let a=Qe(e.target);if(!a){this._ngZone.run(()=>{this.dragEnded.emit({value:null,event:e})});return}a.closest(".mat-calendar-body")===this._elementRef.nativeElement&&this._ngZone.run(()=>{let t=this._getCellFromElement(a);this.dragEnded.emit({value:t?.rawValue??null,event:e})})};_touchendHandler=e=>{let a=Kt(e);a&&this._mouseupHandler({target:a})};_getCellFromElement(e){let a=Qe(e);if(a){let t=a.getAttribute("data-mat-row"),n=a.getAttribute("data-mat-col");if(t&&n)return this.rows[parseInt(t)]?.[parseInt(n)]||null}return null}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["","mat-calendar-body",""]],hostAttrs:[1,"mat-calendar-body"],inputs:{label:"label",rows:"rows",todayValue:"todayValue",startValue:"startValue",endValue:"endValue",labelMinRequiredCells:"labelMinRequiredCells",numCols:"numCols",activeCell:"activeCell",isRange:"isRange",cellAspectRatio:"cellAspectRatio",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",previewStart:"previewStart",previewEnd:"previewEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName"},outputs:{selectedValueChange:"selectedValueChange",previewChange:"previewChange",activeDateChange:"activeDateChange",dragStarted:"dragStarted",dragEnded:"dragEnded"},exportAs:["matCalendarBody"],features:[P],attrs:oa,decls:11,vars:11,consts:[["aria-hidden","true"],["role","row"],[1,"mat-calendar-body-hidden-label",3,"id"],[1,"mat-calendar-body-label"],[1,"mat-calendar-body-label",3,"paddingTop","paddingBottom"],["role","gridcell",1,"mat-calendar-body-cell-container",3,"width","paddingTop","paddingBottom"],["role","gridcell",1,"mat-calendar-body-cell-container"],["type","button",1,"mat-calendar-body-cell",3,"click","focus","tabindex"],[1,"mat-calendar-body-cell-content","mat-focus-indicator"],["aria-hidden","true",1,"mat-calendar-body-cell-preview"]],template:function(a,t){a&1&&(Z(0,la,3,6,"tr",0),ge(1,ha,4,1,"tr",1,da,!0),S(3,"span",2),g(4),V(),S(5,"span",2),g(6),V(),S(7,"span",2),g(8),V(),S(9,"span",2),g(10),V()),a&2&&(J(t._firstRowOffset<t.labelMinRequiredCells?0:-1),d(),fe(t.rows),d(2),L("id",t._startDateLabelId),d(),z(" ",t.startDateAccessibleName,`
`),d(),L("id",t._endDateLabelId),d(),z(" ",t.endDateAccessibleName,`
`),d(),L("id",t._comparisonStartDateLabelId),d(),He(" ",t.comparisonDateAccessibleName," ",t.startDateAccessibleName,`
`),d(),L("id",t._comparisonEndDateLabelId),d(),He(" ",t.comparisonDateAccessibleName," ",t.endDateAccessibleName,`
`))},styles:[`.mat-calendar-body {
  min-width: 224px;
}

.mat-calendar-body-today:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  border-color: var(--mat-datepicker-calendar-date-today-outline-color, var(--mat-sys-primary));
}

.mat-calendar-body-label {
  height: 0;
  line-height: 0;
  text-align: start;
  padding-left: 4.7142857143%;
  padding-right: 4.7142857143%;
  font-size: var(--mat-datepicker-calendar-body-label-text-size, var(--mat-sys-title-small-size));
  font-weight: var(--mat-datepicker-calendar-body-label-text-weight, var(--mat-sys-title-small-weight));
  color: var(--mat-datepicker-calendar-body-label-text-color, var(--mat-sys-on-surface));
}

.mat-calendar-body-hidden-label {
  display: none;
}

.mat-calendar-body-cell-container {
  position: relative;
  height: 0;
  line-height: 0;
}

.mat-calendar-body-cell {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: none;
  text-align: center;
  outline: none;
  margin: 0;
  font-family: var(--mat-datepicker-calendar-text-font, var(--mat-sys-body-medium-font));
  font-size: var(--mat-datepicker-calendar-text-size, var(--mat-sys-body-medium-size));
  -webkit-user-select: none;
  user-select: none;
  cursor: pointer;
  outline: none;
  border: none;
  -webkit-tap-highlight-color: transparent;
}
.mat-calendar-body-cell::-moz-focus-inner {
  border: 0;
}

.mat-calendar-body-cell::before,
.mat-calendar-body-cell::after,
.mat-calendar-body-cell-preview {
  content: "";
  position: absolute;
  top: 5%;
  left: 0;
  z-index: 0;
  box-sizing: border-box;
  display: block;
  height: 90%;
  width: 100%;
}

.mat-calendar-body-range-start:not(.mat-calendar-body-in-comparison-range)::before,
.mat-calendar-body-range-start::after,
.mat-calendar-body-comparison-start:not(.mat-calendar-body-comparison-bridge-start)::before,
.mat-calendar-body-comparison-start::after,
.mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  left: 5%;
  width: 95%;
  border-top-left-radius: 999px;
  border-bottom-left-radius: 999px;
}
[dir=rtl] .mat-calendar-body-range-start:not(.mat-calendar-body-in-comparison-range)::before,
[dir=rtl] .mat-calendar-body-range-start::after,
[dir=rtl] .mat-calendar-body-comparison-start:not(.mat-calendar-body-comparison-bridge-start)::before,
[dir=rtl] .mat-calendar-body-comparison-start::after,
[dir=rtl] .mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  left: 0;
  border-radius: 0;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}

.mat-calendar-body-range-end:not(.mat-calendar-body-in-comparison-range)::before,
.mat-calendar-body-range-end::after,
.mat-calendar-body-comparison-end:not(.mat-calendar-body-comparison-bridge-end)::before,
.mat-calendar-body-comparison-end::after,
.mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  width: 95%;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}
[dir=rtl] .mat-calendar-body-range-end:not(.mat-calendar-body-in-comparison-range)::before,
[dir=rtl] .mat-calendar-body-range-end::after,
[dir=rtl] .mat-calendar-body-comparison-end:not(.mat-calendar-body-comparison-bridge-end)::before,
[dir=rtl] .mat-calendar-body-comparison-end::after,
[dir=rtl] .mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  left: 5%;
  border-radius: 0;
  border-top-left-radius: 999px;
  border-bottom-left-radius: 999px;
}

[dir=rtl] .mat-calendar-body-comparison-bridge-start.mat-calendar-body-range-end::after,
[dir=rtl] .mat-calendar-body-comparison-bridge-end.mat-calendar-body-range-start::after {
  width: 95%;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}

.mat-calendar-body-comparison-start.mat-calendar-body-range-end::after, [dir=rtl] .mat-calendar-body-comparison-start.mat-calendar-body-range-end::after,
.mat-calendar-body-comparison-end.mat-calendar-body-range-start::after,
[dir=rtl] .mat-calendar-body-comparison-end.mat-calendar-body-range-start::after {
  width: 90%;
}

.mat-calendar-body-in-preview {
  color: var(--mat-datepicker-calendar-date-preview-state-outline-color, var(--mat-sys-primary));
}
.mat-calendar-body-in-preview .mat-calendar-body-cell-preview {
  border-top: dashed 1px;
  border-bottom: dashed 1px;
}

.mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  border-left: dashed 1px;
}
[dir=rtl] .mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  border-left: 0;
  border-right: dashed 1px;
}

.mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  border-right: dashed 1px;
}
[dir=rtl] .mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  border-right: 0;
  border-left: dashed 1px;
}

.mat-calendar-body-disabled {
  cursor: default;
}
.mat-calendar-body-disabled > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  color: var(--mat-datepicker-calendar-date-disabled-state-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-calendar-body-disabled > .mat-calendar-body-today:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  border-color: var(--mat-datepicker-calendar-date-today-disabled-state-outline-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mat-calendar-body-disabled {
    opacity: 0.5;
  }
}

.mat-calendar-body-cell-content {
  top: 5%;
  left: 5%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 90%;
  height: 90%;
  line-height: 1;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  color: var(--mat-datepicker-calendar-date-text-color, var(--mat-sys-on-surface));
  border-color: var(--mat-datepicker-calendar-date-outline-color, transparent);
}
.mat-calendar-body-cell-content.mat-focus-indicator {
  position: absolute;
}
@media (forced-colors: active) {
  .mat-calendar-body-cell-content {
    border: none;
  }
}

.cdk-keyboard-focused .mat-calendar-body-active > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical), .cdk-program-focused .mat-calendar-body-active > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  background-color: var(--mat-datepicker-calendar-date-focus-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) calc(var(--mat-sys-focus-state-layer-opacity) * 100%), transparent));
}

@media (hover: hover) {
  .mat-calendar-body-cell:not(.mat-calendar-body-disabled):hover > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
    background-color: var(--mat-datepicker-calendar-date-hover-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) calc(var(--mat-sys-hover-state-layer-opacity) * 100%), transparent));
  }
}
.mat-calendar-body-selected {
  background-color: var(--mat-datepicker-calendar-date-selected-state-background-color, var(--mat-sys-primary));
  color: var(--mat-datepicker-calendar-date-selected-state-text-color, var(--mat-sys-on-primary));
}
.mat-calendar-body-disabled > .mat-calendar-body-selected {
  background-color: var(--mat-datepicker-calendar-date-selected-disabled-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-calendar-body-selected.mat-calendar-body-today {
  box-shadow: inset 0 0 0 1px var(--mat-datepicker-calendar-date-today-selected-state-outline-color, var(--mat-sys-primary));
}

.mat-calendar-body-in-range::before {
  background: var(--mat-datepicker-calendar-date-in-range-state-background-color, var(--mat-sys-primary-container));
}

.mat-calendar-body-comparison-identical,
.mat-calendar-body-in-comparison-range::before {
  background: var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container));
}

.mat-calendar-body-comparison-identical,
.mat-calendar-body-in-comparison-range::before {
  background: var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container));
}

.mat-calendar-body-comparison-bridge-start::before,
[dir=rtl] .mat-calendar-body-comparison-bridge-end::before {
  background: linear-gradient(to right, var(--mat-datepicker-calendar-date-in-range-state-background-color, var(--mat-sys-primary-container)) 50%, var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container)) 50%);
}

.mat-calendar-body-comparison-bridge-end::before,
[dir=rtl] .mat-calendar-body-comparison-bridge-start::before {
  background: linear-gradient(to left, var(--mat-datepicker-calendar-date-in-range-state-background-color, var(--mat-sys-primary-container)) 50%, var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container)) 50%);
}

.mat-calendar-body-in-range > .mat-calendar-body-comparison-identical,
.mat-calendar-body-in-comparison-range.mat-calendar-body-in-range::after {
  background: var(--mat-datepicker-calendar-date-in-overlap-range-state-background-color, var(--mat-sys-secondary-container));
}

.mat-calendar-body-comparison-identical.mat-calendar-body-selected,
.mat-calendar-body-in-comparison-range > .mat-calendar-body-selected {
  background: var(--mat-datepicker-calendar-date-in-overlap-range-selected-state-background-color, var(--mat-sys-secondary));
}

@media (forced-colors: active) {
  .mat-datepicker-popup:not(:empty),
  .mat-calendar-body-cell:not(.mat-calendar-body-in-range) .mat-calendar-body-selected {
    outline: solid 1px;
  }
  .mat-calendar-body-today {
    outline: dotted 1px;
  }
  .mat-calendar-body-cell::before,
  .mat-calendar-body-cell::after,
  .mat-calendar-body-selected {
    background: none;
  }
  .mat-calendar-body-in-range::before,
  .mat-calendar-body-comparison-bridge-start::before,
  .mat-calendar-body-comparison-bridge-end::before {
    border-top: solid 1px;
    border-bottom: solid 1px;
  }
  .mat-calendar-body-range-start::before {
    border-left: solid 1px;
  }
  [dir=rtl] .mat-calendar-body-range-start::before {
    border-left: 0;
    border-right: solid 1px;
  }
  .mat-calendar-body-range-end::before {
    border-right: solid 1px;
  }
  [dir=rtl] .mat-calendar-body-range-end::before {
    border-right: 0;
    border-left: solid 1px;
  }
  .mat-calendar-body-in-comparison-range::before {
    border-top: dashed 1px;
    border-bottom: dashed 1px;
  }
  .mat-calendar-body-comparison-start::before {
    border-left: dashed 1px;
  }
  [dir=rtl] .mat-calendar-body-comparison-start::before {
    border-left: 0;
    border-right: dashed 1px;
  }
  .mat-calendar-body-comparison-end::before {
    border-right: dashed 1px;
  }
  [dir=rtl] .mat-calendar-body-comparison-end::before {
    border-right: 0;
    border-left: dashed 1px;
  }
}
`],encapsulation:2,changeDetection:0})}return i})();function qe(i){return i?.nodeName==="TD"}function Qe(i){let s;return qe(i)?s=i:qe(i.parentNode)?s=i.parentNode:qe(i.parentNode?.parentNode)&&(s=i.parentNode.parentNode),s?.getAttribute("data-mat-row")!=null?s:null}function Ge(i,s,e){return e!==null&&s!==e&&i<e&&i===s}function Ue(i,s,e){return s!==null&&s!==e&&i>=s&&i===e}function $e(i,s,e,a){return a&&s!==null&&e!==null&&s!==e&&i>=s&&i<=e}function Kt(i){let s=i.changedTouches[0];return document.elementFromPoint(s.clientX,s.clientY)}var A=class{start;end;_disableStructuralEquivalency;constructor(s,e){this.start=s,this.end=e}},de=(()=>{class i{selection;_adapter;_selectionChanged=new O;selectionChanged=this._selectionChanged;constructor(e,a){this.selection=e,this._adapter=a,this.selection=e}updateSelection(e,a){let t=this.selection;this.selection=e,this._selectionChanged.next({selection:e,source:a,oldValue:t})}ngOnDestroy(){this._selectionChanged.complete()}_isValidDateInstance(e){return this._adapter.isDateInstance(e)&&this._adapter.isValid(e)}static \u0275fac=function(a){ot()};static \u0275prov=ue({token:i,factory:i.\u0275fac})}return i})(),Ma=(()=>{class i extends de{constructor(e){super(null,e)}add(e){super.updateSelection(e,this)}isValid(){return this.selection!=null&&this._isValidDateInstance(this.selection)}isComplete(){return this.selection!=null}clone(){let e=new i(this._adapter);return e.updateSelection(this.selection,this),e}static \u0275fac=function(a){return new(a||i)(rt(C))};static \u0275prov=ue({token:i,factory:i.\u0275fac})}return i})();var $t={provide:de,useFactory:()=>o(de,{optional:!0,skipSelf:!0})||new Ma(o(C))};var Xt=new Re("MAT_DATE_RANGE_SELECTION_STRATEGY");var Xe=7,Sa=0,jt=(()=>{class i{_changeDetectorRef=o(R);_dateFormats=o(K,{optional:!0});_dateAdapter=o(C,{optional:!0});_dir=o(ae,{optional:!0});_rangeStrategy=o(Xt,{optional:!0});_rerenderSubscription=M.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let a=this._activeDate,t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(t,this.minDate,this.maxDate),this._hasSameMonthAndYear(a,this._activeDate)||this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof A?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setRanges(this._selected)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;activeDrag=null;selectedChange=new c;_userSelection=new c;dragStarted=new c;dragEnded=new c;activeDateChange=new c;_matCalendarBody;_monthLabel=h("");_weeks=h([]);_firstWeekOffset=h(0);_rangeStart=h(null);_rangeEnd=h(null);_comparisonRangeStart=h(null);_comparisonRangeEnd=h(null);_previewStart=h(null);_previewEnd=h(null);_isRange=h(!1);_todayDate=h(null);_weekdays=h([]);constructor(){o(te).load(ke),this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(he(null)).subscribe(()=>this._init())}ngOnChanges(e){let a=e.comparisonStart||e.comparisonEnd;a&&!a.firstChange&&this._setRanges(this.selected),e.activeDrag&&!this.activeDrag&&this._clearPreview()}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_dateSelected(e){let a=e.value,t=this._getDateFromDayOfMonth(a),n,r;this._selected instanceof A?(n=this._getDateInCurrentMonth(this._selected.start),r=this._getDateInCurrentMonth(this._selected.end)):n=r=this._getDateInCurrentMonth(this._selected),(n!==a||r!==a)&&this.selectedChange.emit(t),this._userSelection.emit({value:t,event:e.event}),this._clearPreview(),this._changeDetectorRef.markForCheck()}_updateActiveDate(e){let a=e.value,t=this._activeDate;this.activeDate=this._getDateFromDayOfMonth(a),this._dateAdapter.compareDate(t,this.activeDate)&&this.activeDateChange.emit(this._activeDate)}_handleCalendarBodyKeydown(e){let a=this._activeDate,t=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,t?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,t?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,-7);break;case 40:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,7);break;case 36:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,1-this._dateAdapter.getDate(this._activeDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,this._dateAdapter.getNumDaysInMonth(this._activeDate)-this._dateAdapter.getDate(this._activeDate));break;case 33:this.activeDate=e.altKey?this._dateAdapter.addCalendarYears(this._activeDate,-1):this._dateAdapter.addCalendarMonths(this._activeDate,-1);break;case 34:this.activeDate=e.altKey?this._dateAdapter.addCalendarYears(this._activeDate,1):this._dateAdapter.addCalendarMonths(this._activeDate,1);break;case 13:case 32:this._selectionKeyPressed=!0,this._canSelect(this._activeDate)&&e.preventDefault();return;case 27:this._previewEnd()!=null&&!H(e)&&(this._clearPreview(),this.activeDrag?this.dragEnded.emit({value:null,event:e}):(this.selectedChange.emit(null),this._userSelection.emit({value:null,event:e})),e.preventDefault(),e.stopPropagation());return;default:return}this._dateAdapter.compareDate(a,this.activeDate)&&(this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked()),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._canSelect(this._activeDate)&&this._dateSelected({value:this._dateAdapter.getDate(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_init(){this._setRanges(this.selected),this._todayDate.set(this._getCellCompareValue(this._dateAdapter.today())),this._monthLabel.set(this._dateFormats.display.monthLabel?this._dateAdapter.format(this.activeDate,this._dateFormats.display.monthLabel):this._dateAdapter.getMonthNames("short")[this._dateAdapter.getMonth(this.activeDate)].toLocaleUpperCase());let e=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),1);this._firstWeekOffset.set((Xe+this._dateAdapter.getDayOfWeek(e)-this._dateAdapter.getFirstDayOfWeek())%Xe),this._initWeekdays(),this._createWeekCells(),this._changeDetectorRef.markForCheck()}_focusActiveCell(e){this._matCalendarBody._focusActiveCell(e)}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_previewChanged({event:e,value:a}){if(this._rangeStrategy){let t=a?a.rawValue:null,n=this._rangeStrategy.createPreview(t,this.selected,e);if(this._previewStart.set(this._getCellCompareValue(n.start)),this._previewEnd.set(this._getCellCompareValue(n.end)),this.activeDrag&&t){let r=this._rangeStrategy.createDrag?.(this.activeDrag.value,this.selected,t,e);r&&(this._previewStart.set(this._getCellCompareValue(r.start)),this._previewEnd.set(this._getCellCompareValue(r.end)))}}}_dragEnded(e){if(this.activeDrag)if(e.value){let a=this._rangeStrategy?.createDrag?.(this.activeDrag.value,this.selected,e.value,e.event);this.dragEnded.emit({value:a??null,event:e.event})}else this.dragEnded.emit({value:null,event:e.event})}_getDateFromDayOfMonth(e){return this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),e)}_initWeekdays(){let e=this._dateAdapter.getFirstDayOfWeek(),a=this._dateAdapter.getDayOfWeekNames("narrow"),n=this._dateAdapter.getDayOfWeekNames("long").map((r,b)=>({long:r,narrow:a[b],id:Sa++}));this._weekdays.set(n.slice(e).concat(n.slice(0,e)))}_createWeekCells(){let e=this._dateAdapter.getNumDaysInMonth(this.activeDate),a=this._dateAdapter.getDateNames(),t=[[]];for(let n=0,r=this._firstWeekOffset();n<e;n++,r++){r==Xe&&(t.push([]),r=0);let b=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),n+1),na=this._shouldEnableDate(b),ia=this._dateAdapter.format(b,this._dateFormats.display.dateA11yLabel),ra=this.dateClass?this.dateClass(b,"month"):void 0;t[t.length-1].push(new oe(n+1,a[n],ia,na,ra,this._getCellCompareValue(b),b))}this._weeks.set(t)}_shouldEnableDate(e){return!!e&&(!this.minDate||this._dateAdapter.compareDate(e,this.minDate)>=0)&&(!this.maxDate||this._dateAdapter.compareDate(e,this.maxDate)<=0)&&(!this.dateFilter||this.dateFilter(e))}_getDateInCurrentMonth(e){return e&&this._hasSameMonthAndYear(e,this.activeDate)?this._dateAdapter.getDate(e):null}_hasSameMonthAndYear(e,a){return!!(e&&a&&this._dateAdapter.getMonth(e)==this._dateAdapter.getMonth(a)&&this._dateAdapter.getYear(e)==this._dateAdapter.getYear(a))}_getCellCompareValue(e){if(e){let a=this._dateAdapter.getYear(e),t=this._dateAdapter.getMonth(e),n=this._dateAdapter.getDate(e);return new Date(a,t,n).getTime()}return null}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setRanges(e){e instanceof A?(this._rangeStart.set(this._getCellCompareValue(e.start)),this._rangeEnd.set(this._getCellCompareValue(e.end)),this._isRange.set(!0)):(this._rangeStart.set(this._getCellCompareValue(e)),this._rangeEnd.set(this._rangeStart()),this._isRange.set(!1)),this._comparisonRangeStart.set(this._getCellCompareValue(this.comparisonStart)),this._comparisonRangeEnd.set(this._getCellCompareValue(this.comparisonEnd))}_canSelect(e){return!this.dateFilter||this.dateFilter(e)}_clearPreview(){this._previewStart.set(null),this._previewEnd.set(null)}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-month-view"]],viewQuery:function(a,t){if(a&1&&N(Q,5),a&2){let n;E(n=x())&&(t._matCalendarBody=n.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName",activeDrag:"activeDrag"},outputs:{selectedChange:"selectedChange",_userSelection:"_userSelection",dragStarted:"dragStarted",dragEnded:"dragEnded",activeDateChange:"activeDateChange"},exportAs:["matMonthView"],features:[P],decls:8,vars:14,consts:[["role","grid",1,"mat-calendar-table"],[1,"mat-calendar-table-header"],["scope","col"],["aria-hidden","true"],["colspan","7",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","previewChange","dragStarted","dragEnded","keyup","keydown","label","rows","todayValue","startValue","endValue","comparisonStart","comparisonEnd","previewStart","previewEnd","isRange","labelMinRequiredCells","activeCell","startDateAccessibleName","endDateAccessibleName"],[1,"cdk-visually-hidden"]],template:function(a,t){a&1&&(l(0,"table",0)(1,"thead",1)(2,"tr"),ge(3,ua,5,2,"th",2,Ut),p(),l(5,"tr",3),D(6,"th",4),p()(),l(7,"tbody",5),m("selectedValueChange",function(r){return t._dateSelected(r)})("activeDateChange",function(r){return t._updateActiveDate(r)})("previewChange",function(r){return t._previewChanged(r)})("dragStarted",function(r){return t.dragStarted.emit(r)})("dragEnded",function(r){return t._dragEnded(r)})("keyup",function(r){return t._handleCalendarBodyKeyup(r)})("keydown",function(r){return t._handleCalendarBodyKeydown(r)}),p()()),a&2&&(d(3),fe(t._weekdays()),d(4),_("label",t._monthLabel())("rows",t._weeks())("todayValue",t._todayDate())("startValue",t._rangeStart())("endValue",t._rangeEnd())("comparisonStart",t._comparisonRangeStart())("comparisonEnd",t._comparisonRangeEnd())("previewStart",t._previewStart())("previewEnd",t._previewEnd())("isRange",t._isRange())("labelMinRequiredCells",3)("activeCell",t._dateAdapter.getDate(t.activeDate)-1)("startDateAccessibleName",t.startDateAccessibleName)("endDateAccessibleName",t.endDateAccessibleName))},dependencies:[Q],encapsulation:2,changeDetection:0})}return i})(),w=24,Ze=4,Wt=(()=>{class i{_changeDetectorRef=o(R);_dateAdapter=o(C,{optional:!0});_dir=o(ae,{optional:!0});_rerenderSubscription=M.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let a=this._activeDate,t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(t,this.minDate,this.maxDate),Zt(this._dateAdapter,a,this._activeDate,this.minDate,this.maxDate)||this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof A?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setSelectedYear(e)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;selectedChange=new c;yearSelected=new c;activeDateChange=new c;_matCalendarBody;_years=h([]);_todayYear=h(0);_selectedYear=h(null);constructor(){this._dateAdapter,this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(he(null)).subscribe(()=>this._init())}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_init(){this._todayYear.set(this._dateAdapter.getYear(this._dateAdapter.today()));let a=this._dateAdapter.getYear(this._activeDate)-re(this._dateAdapter,this.activeDate,this.minDate,this.maxDate),t=[];for(let n=0,r=[];n<w;n++)r.push(a+n),r.length==Ze&&(t.push(r.map(b=>this._createCellForYear(b))),r=[]);this._years.set(t),this._changeDetectorRef.markForCheck()}_yearSelected(e){let a=e.value,t=this._dateAdapter.createDate(a,0,1),n=this._getDateFromYear(a);this.yearSelected.emit(t),this.selectedChange.emit(n)}_updateActiveDate(e){let a=e.value,t=this._activeDate;this.activeDate=this._getDateFromYear(a),this._dateAdapter.compareDate(t,this.activeDate)&&this.activeDateChange.emit(this.activeDate)}_handleCalendarBodyKeydown(e){let a=this._activeDate,t=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,t?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,t?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,-Ze);break;case 40:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,Ze);break;case 36:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,-re(this._dateAdapter,this.activeDate,this.minDate,this.maxDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,w-re(this._dateAdapter,this.activeDate,this.minDate,this.maxDate)-1);break;case 33:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?-w*10:-w);break;case 34:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?w*10:w);break;case 13:case 32:this._selectionKeyPressed=!0;break;default:return}this._dateAdapter.compareDate(a,this.activeDate)&&this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked(),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._yearSelected({value:this._dateAdapter.getYear(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_getActiveCell(){return re(this._dateAdapter,this.activeDate,this.minDate,this.maxDate)}_focusActiveCell(){this._matCalendarBody._focusActiveCell()}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_getDateFromYear(e){let a=this._dateAdapter.getMonth(this.activeDate),t=this._dateAdapter.getNumDaysInMonth(this._dateAdapter.createDate(e,a,1));return this._dateAdapter.createDate(e,a,Math.min(this._dateAdapter.getDate(this.activeDate),t))}_createCellForYear(e){let a=this._dateAdapter.createDate(e,0,1),t=this._dateAdapter.getYearName(a),n=this.dateClass?this.dateClass(a,"multi-year"):void 0;return new oe(e,t,t,this._shouldEnableYear(e),n)}_shouldEnableYear(e){if(e==null||this.maxDate&&e>this._dateAdapter.getYear(this.maxDate)||this.minDate&&e<this._dateAdapter.getYear(this.minDate))return!1;if(!this.dateFilter)return!0;let a=this._dateAdapter.createDate(e,0,1);for(let t=a;this._dateAdapter.getYear(t)==e;t=this._dateAdapter.addCalendarDays(t,1))if(this.dateFilter(t))return!0;return!1}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setSelectedYear(e){if(this._selectedYear.set(null),e instanceof A){let a=e.start||e.end;a&&this._selectedYear.set(this._dateAdapter.getYear(a))}else e&&this._selectedYear.set(this._dateAdapter.getYear(e))}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-multi-year-view"]],viewQuery:function(a,t){if(a&1&&N(Q,5),a&2){let n;E(n=x())&&(t._matCalendarBody=n.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass"},outputs:{selectedChange:"selectedChange",yearSelected:"yearSelected",activeDateChange:"activeDateChange"},exportAs:["matMultiYearView"],decls:5,vars:7,consts:[["role","grid",1,"mat-calendar-table"],["aria-hidden","true",1,"mat-calendar-table-header"],["colspan","4",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","keyup","keydown","rows","todayValue","startValue","endValue","numCols","cellAspectRatio","activeCell"]],template:function(a,t){a&1&&(l(0,"table",0)(1,"thead",1)(2,"tr"),D(3,"th",2),p()(),l(4,"tbody",3),m("selectedValueChange",function(r){return t._yearSelected(r)})("activeDateChange",function(r){return t._updateActiveDate(r)})("keyup",function(r){return t._handleCalendarBodyKeyup(r)})("keydown",function(r){return t._handleCalendarBodyKeydown(r)}),p()()),a&2&&(d(4),_("rows",t._years())("todayValue",t._todayYear())("startValue",t._selectedYear())("endValue",t._selectedYear())("numCols",4)("cellAspectRatio",4/7)("activeCell",t._getActiveCell()))},dependencies:[Q],encapsulation:2,changeDetection:0})}return i})();function Zt(i,s,e,a,t){let n=i.getYear(s),r=i.getYear(e),b=Jt(i,a,t);return Math.floor((n-b)/w)===Math.floor((r-b)/w)}function re(i,s,e,a){let t=i.getYear(s);return Va(t-Jt(i,e,a),w)}function Jt(i,s,e){let a=0;return e?a=i.getYear(e)-w+1:s&&(a=i.getYear(s)),a}function Va(i,s){return(i%s+s)%s}var qt=(()=>{class i{_changeDetectorRef=o(R);_dateFormats=o(K,{optional:!0});_dateAdapter=o(C,{optional:!0});_dir=o(ae,{optional:!0});_rerenderSubscription=M.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let a=this._activeDate,t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(t,this.minDate,this.maxDate),this._dateAdapter.getYear(a)!==this._dateAdapter.getYear(this._activeDate)&&this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof A?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setSelectedMonth(e)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;selectedChange=new c;monthSelected=new c;activeDateChange=new c;_matCalendarBody;_months=h([]);_yearLabel=h("");_todayMonth=h(null);_selectedMonth=h(null);constructor(){this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(he(null)).subscribe(()=>this._init())}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_monthSelected(e){let a=e.value,t=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),a,1);this.monthSelected.emit(t);let n=this._getDateFromMonth(a);this.selectedChange.emit(n)}_updateActiveDate(e){let a=e.value,t=this._activeDate;this.activeDate=this._getDateFromMonth(a),this._dateAdapter.compareDate(t,this.activeDate)&&this.activeDateChange.emit(this.activeDate)}_handleCalendarBodyKeydown(e){let a=this._activeDate,t=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,t?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,t?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,-4);break;case 40:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,4);break;case 36:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,-this._dateAdapter.getMonth(this._activeDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,11-this._dateAdapter.getMonth(this._activeDate));break;case 33:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?-10:-1);break;case 34:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?10:1);break;case 13:case 32:this._selectionKeyPressed=!0;break;default:return}this._dateAdapter.compareDate(a,this.activeDate)&&(this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked()),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._monthSelected({value:this._dateAdapter.getMonth(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_init(){this._setSelectedMonth(this.selected),this._todayMonth.set(this._getMonthInCurrentYear(this._dateAdapter.today())),this._yearLabel.set(this._dateAdapter.getYearName(this.activeDate));let e=this._dateAdapter.getMonthNames("short");this._months.set([[0,1,2,3],[4,5,6,7],[8,9,10,11]].map(a=>a.map(t=>this._createCellForMonth(t,e[t])))),this._changeDetectorRef.markForCheck()}_focusActiveCell(){this._matCalendarBody._focusActiveCell()}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_getMonthInCurrentYear(e){return e&&this._dateAdapter.getYear(e)==this._dateAdapter.getYear(this.activeDate)?this._dateAdapter.getMonth(e):null}_getDateFromMonth(e){let a=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,1),t=this._dateAdapter.getNumDaysInMonth(a);return this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,Math.min(this._dateAdapter.getDate(this.activeDate),t))}_createCellForMonth(e,a){let t=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,1),n=this._dateAdapter.format(t,this._dateFormats.display.monthYearA11yLabel),r=this.dateClass?this.dateClass(t,"year"):void 0;return new oe(e,a.toLocaleUpperCase(),n,this._shouldEnableMonth(e),r)}_shouldEnableMonth(e){let a=this._dateAdapter.getYear(this.activeDate);if(e==null||this._isYearAndMonthAfterMaxDate(a,e)||this._isYearAndMonthBeforeMinDate(a,e))return!1;if(!this.dateFilter)return!0;let t=this._dateAdapter.createDate(a,e,1);for(let n=t;this._dateAdapter.getMonth(n)==e;n=this._dateAdapter.addCalendarDays(n,1))if(this.dateFilter(n))return!0;return!1}_isYearAndMonthAfterMaxDate(e,a){if(this.maxDate){let t=this._dateAdapter.getYear(this.maxDate),n=this._dateAdapter.getMonth(this.maxDate);return e>t||e===t&&a>n}return!1}_isYearAndMonthBeforeMinDate(e,a){if(this.minDate){let t=this._dateAdapter.getYear(this.minDate),n=this._dateAdapter.getMonth(this.minDate);return e<t||e===t&&a<n}return!1}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setSelectedMonth(e){e instanceof A?this._selectedMonth.set(this._getMonthInCurrentYear(e.start)||this._getMonthInCurrentYear(e.end)):this._selectedMonth.set(this._getMonthInCurrentYear(e))}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-year-view"]],viewQuery:function(a,t){if(a&1&&N(Q,5),a&2){let n;E(n=x())&&(t._matCalendarBody=n.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass"},outputs:{selectedChange:"selectedChange",monthSelected:"monthSelected",activeDateChange:"activeDateChange"},exportAs:["matYearView"],decls:5,vars:9,consts:[["role","grid",1,"mat-calendar-table"],["aria-hidden","true",1,"mat-calendar-table-header"],["colspan","4",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","keyup","keydown","label","rows","todayValue","startValue","endValue","labelMinRequiredCells","numCols","cellAspectRatio","activeCell"]],template:function(a,t){a&1&&(l(0,"table",0)(1,"thead",1)(2,"tr"),D(3,"th",2),p()(),l(4,"tbody",3),m("selectedValueChange",function(r){return t._monthSelected(r)})("activeDateChange",function(r){return t._updateActiveDate(r)})("keyup",function(r){return t._handleCalendarBodyKeyup(r)})("keydown",function(r){return t._handleCalendarBodyKeydown(r)}),p()()),a&2&&(d(4),_("label",t._yearLabel())("rows",t._months())("todayValue",t._todayMonth())("startValue",t._selectedMonth())("endValue",t._selectedMonth())("labelMinRequiredCells",2)("numCols",4)("cellAspectRatio",4/7)("activeCell",t._dateAdapter.getMonth(t.activeDate)))},dependencies:[Q],encapsulation:2,changeDetection:0})}return i})(),Fe=(()=>{class i{_intl=o(G);calendar=o(Je);_dateAdapter=o(C,{optional:!0});_dateFormats=o(K,{optional:!0});_periodButtonText;_periodButtonDescription;_periodButtonLabel;_prevButtonLabel;_nextButtonLabel;constructor(){o(te).load(ke);let e=o(R);this._updateLabels(),this.calendar.stateChanges.subscribe(()=>{this._updateLabels(),e.markForCheck()})}get periodButtonText(){return this._periodButtonText}get periodButtonDescription(){return this._periodButtonDescription}get periodButtonLabel(){return this._periodButtonLabel}get prevButtonLabel(){return this._prevButtonLabel}get nextButtonLabel(){return this._nextButtonLabel}currentPeriodClicked(){this.calendar.currentView=this.calendar.currentView=="month"?"multi-year":"month"}previousClicked(){this.previousEnabled()&&(this.calendar.activeDate=this.calendar.currentView=="month"?this._dateAdapter.addCalendarMonths(this.calendar.activeDate,-1):this._dateAdapter.addCalendarYears(this.calendar.activeDate,this.calendar.currentView=="year"?-1:-w))}nextClicked(){this.nextEnabled()&&(this.calendar.activeDate=this.calendar.currentView=="month"?this._dateAdapter.addCalendarMonths(this.calendar.activeDate,1):this._dateAdapter.addCalendarYears(this.calendar.activeDate,this.calendar.currentView=="year"?1:w))}previousEnabled(){return this.calendar.minDate?!this.calendar.minDate||!this._isSameView(this.calendar.activeDate,this.calendar.minDate):!0}nextEnabled(){return!this.calendar.maxDate||!this._isSameView(this.calendar.activeDate,this.calendar.maxDate)}_updateLabels(){let e=this.calendar,a=this._intl,t=this._dateAdapter;e.currentView==="month"?(this._periodButtonText=t.format(e.activeDate,this._dateFormats.display.monthYearLabel).toLocaleUpperCase(),this._periodButtonDescription=t.format(e.activeDate,this._dateFormats.display.monthYearLabel).toLocaleUpperCase(),this._periodButtonLabel=a.switchToMultiYearViewLabel,this._prevButtonLabel=a.prevMonthLabel,this._nextButtonLabel=a.nextMonthLabel):e.currentView==="year"?(this._periodButtonText=t.getYearName(e.activeDate),this._periodButtonDescription=t.getYearName(e.activeDate),this._periodButtonLabel=a.switchToMonthViewLabel,this._prevButtonLabel=a.prevYearLabel,this._nextButtonLabel=a.nextYearLabel):(this._periodButtonText=a.formatYearRange(...this._formatMinAndMaxYearLabels()),this._periodButtonDescription=a.formatYearRangeLabel(...this._formatMinAndMaxYearLabels()),this._periodButtonLabel=a.switchToMonthViewLabel,this._prevButtonLabel=a.prevMultiYearLabel,this._nextButtonLabel=a.nextMultiYearLabel)}_isSameView(e,a){return this.calendar.currentView=="month"?this._dateAdapter.getYear(e)==this._dateAdapter.getYear(a)&&this._dateAdapter.getMonth(e)==this._dateAdapter.getMonth(a):this.calendar.currentView=="year"?this._dateAdapter.getYear(e)==this._dateAdapter.getYear(a):Zt(this._dateAdapter,e,a,this.calendar.minDate,this.calendar.maxDate)}_formatMinAndMaxYearLabels(){let a=this._dateAdapter.getYear(this.calendar.activeDate)-re(this._dateAdapter,this.calendar.activeDate,this.calendar.minDate,this.calendar.maxDate),t=a+w-1,n=this._dateAdapter.getYearName(this._dateAdapter.createDate(a,0,1)),r=this._dateAdapter.getYearName(this._dateAdapter.createDate(t,0,1));return[n,r]}_periodButtonLabelId=o(Ae).getId("mat-calendar-period-label-");static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-calendar-header"]],exportAs:["matCalendarHeader"],ngContentSelectors:ma,decls:17,vars:13,consts:[[1,"mat-calendar-header"],[1,"mat-calendar-controls"],["aria-live","polite",1,"cdk-visually-hidden",3,"id"],["matButton","","type","button",1,"mat-calendar-period-button",3,"click"],["aria-hidden","true"],["viewBox","0 0 10 5","focusable","false","aria-hidden","true",1,"mat-calendar-arrow"],["points","0,0 5,5 10,0"],[1,"mat-calendar-spacer"],["matIconButton","","type","button","disabledInteractive","",1,"mat-calendar-previous-button",3,"click","disabled","matTooltip"],["viewBox","0 0 24 24","focusable","false","aria-hidden","true"],["d","M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],["matIconButton","","type","button","disabledInteractive","",1,"mat-calendar-next-button",3,"click","disabled","matTooltip"],["d","M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"]],template:function(a,t){a&1&&(Ne(),l(0,"div",0)(1,"div",1)(2,"span",2),g(3),p(),l(4,"button",3),m("click",function(){return t.currentPeriodClicked()}),l(5,"span",4),g(6),p(),F(),l(7,"svg",5),D(8,"polygon",6),p()(),Y(),D(9,"div",7),Be(10),l(11,"button",8),m("click",function(){return t.previousClicked()}),F(),l(12,"svg",9),D(13,"path",10),p()(),Y(),l(14,"button",11),m("click",function(){return t.nextClicked()}),F(),l(15,"svg",9),D(16,"path",12),p()()()()),a&2&&(d(2),_("id",t._periodButtonLabelId),d(),T(t.periodButtonDescription),d(),f("aria-label",t.periodButtonLabel)("aria-describedby",t._periodButtonLabelId),d(2),T(t.periodButtonText),d(),I("mat-calendar-invert",t.calendar.currentView!=="month"),d(4),_("disabled",!t.previousEnabled())("matTooltip",t.prevButtonLabel),f("aria-label",t.prevButtonLabel),d(3),_("disabled",!t.nextEnabled())("matTooltip",t.nextButtonLabel),f("aria-label",t.nextButtonLabel))},dependencies:[ie,ne,Pt],encapsulation:2,changeDetection:0})}return i})(),Je=(()=>{class i{_dateAdapter=o(C,{optional:!0});_dateFormats=o(K,{optional:!0});_changeDetectorRef=o(R);_elementRef=o(U);headerComponent;_calendarHeaderPortal;_intlChanges;_moveFocusOnNextTick=!1;get startAt(){return this._startAt}set startAt(e){this._startAt=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_startAt=null;startView="month";get selected(){return this._selected}set selected(e){e instanceof A?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;selectedChange=new c;yearSelected=new c;monthSelected=new c;viewChanged=new c(!0);_userSelection=new c;_userDragDrop=new c;monthView;yearView;multiYearView;get activeDate(){return this._clampedActiveDate}set activeDate(e){this._clampedActiveDate=this._dateAdapter.clampDate(e,this.minDate,this.maxDate),this.stateChanges.next(),this._changeDetectorRef.markForCheck()}_clampedActiveDate;get currentView(){return this._currentView}set currentView(e){let a=this._currentView!==e?e:null;this._currentView=e,this._moveFocusOnNextTick=!0,this._changeDetectorRef.markForCheck(),a&&(this.stateChanges.next(),this.viewChanged.emit(a))}_currentView;_activeDrag=null;stateChanges=new O;constructor(){this._intlChanges=o(G).changes.subscribe(()=>{this._changeDetectorRef.markForCheck(),this.stateChanges.next()})}ngAfterContentInit(){this._calendarHeaderPortal=new je(this.headerComponent||Fe),this.activeDate=this.startAt||this._dateAdapter.today(),this._currentView=this.startView}ngAfterViewChecked(){this._moveFocusOnNextTick&&(this._moveFocusOnNextTick=!1,this.focusActiveCell())}ngOnDestroy(){this._intlChanges.unsubscribe(),this.stateChanges.complete()}ngOnChanges(e){let a=e.minDate&&!this._dateAdapter.sameDate(e.minDate.previousValue,e.minDate.currentValue)?e.minDate:void 0,t=e.maxDate&&!this._dateAdapter.sameDate(e.maxDate.previousValue,e.maxDate.currentValue)?e.maxDate:void 0,n=a||t||e.dateFilter;if(n&&!n.firstChange){let r=this._getCurrentViewComponent();r&&(this._elementRef.nativeElement.contains(ze())&&(this._moveFocusOnNextTick=!0),this._changeDetectorRef.detectChanges(),r._init())}this.stateChanges.next()}focusActiveCell(){this._getCurrentViewComponent()?._focusActiveCell(!1)}updateTodaysDate(){this._getCurrentViewComponent()?._init()}_dateSelected(e){let a=e.value;(this.selected instanceof A||a&&!this._dateAdapter.sameDate(a,this.selected))&&this.selectedChange.emit(a),this._userSelection.emit(e)}_yearSelectedInMultiYearView(e){this.yearSelected.emit(e)}_monthSelectedInYearView(e){this.monthSelected.emit(e)}_goToDateInView(e,a){this.activeDate=e,this.currentView=a}_dragStarted(e){this._activeDrag=e}_dragEnded(e){this._activeDrag&&(e.value&&this._userDragDrop.emit(e),this._activeDrag=null)}_getCurrentViewComponent(){return this.monthView||this.yearView||this.multiYearView}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-calendar"]],viewQuery:function(a,t){if(a&1&&N(jt,5)(qt,5)(Wt,5),a&2){let n;E(n=x())&&(t.monthView=n.first),E(n=x())&&(t.yearView=n.first),E(n=x())&&(t.multiYearView=n.first)}},hostAttrs:[1,"mat-calendar"],inputs:{headerComponent:"headerComponent",startAt:"startAt",startView:"startView",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName"},outputs:{selectedChange:"selectedChange",yearSelected:"yearSelected",monthSelected:"monthSelected",viewChanged:"viewChanged",_userSelection:"_userSelection",_userDragDrop:"_userDragDrop"},exportAs:["matCalendar"],features:[we([$t]),P],decls:5,vars:2,consts:[[3,"cdkPortalOutlet"],["cdkMonitorSubtreeFocus","","tabindex","-1",1,"mat-calendar-content"],[3,"activeDate","selected","dateFilter","maxDate","minDate","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName","activeDrag"],[3,"activeDate","selected","dateFilter","maxDate","minDate","dateClass"],[3,"activeDateChange","_userSelection","dragStarted","dragEnded","activeDate","selected","dateFilter","maxDate","minDate","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName","activeDrag"],[3,"activeDateChange","monthSelected","selectedChange","activeDate","selected","dateFilter","maxDate","minDate","dateClass"],[3,"activeDateChange","yearSelected","selectedChange","activeDate","selected","dateFilter","maxDate","minDate","dateClass"]],template:function(a,t){if(a&1&&(Le(0,_a,0,0,"ng-template",0),l(1,"div",1),Z(2,ga,1,11,"mat-month-view",2)(3,fa,1,6,"mat-year-view",3)(4,ba,1,6,"mat-multi-year-view",3),p()),a&2){let n;_("cdkPortalOutlet",t._calendarHeaderPortal),d(2),J((n=t.currentView)==="month"?2:n==="year"?3:n==="multi-year"?4:-1)}},dependencies:[We,ft,jt,qt,Wt],styles:[`.mat-calendar {
  display: block;
  line-height: normal;
  font-family: var(--mat-datepicker-calendar-text-font, var(--mat-sys-body-medium-font));
  font-size: var(--mat-datepicker-calendar-text-size, var(--mat-sys-body-medium-size));
}

.mat-calendar-header {
  padding: 8px 8px 0 8px;
}

.mat-calendar-content {
  padding: 0 8px 8px 8px;
  outline: none;
}

.mat-calendar-controls {
  display: flex;
  align-items: center;
  margin: 5% calc(4.7142857143% - 16px);
}

.mat-calendar-spacer {
  flex: 1 1 auto;
}

.mat-calendar-period-button {
  min-width: 0;
  margin: 0 8px;
  font-size: var(--mat-datepicker-calendar-period-button-text-size, var(--mat-sys-title-small-size));
  font-weight: var(--mat-datepicker-calendar-period-button-text-weight, var(--mat-sys-title-small-weight));
  --mat-button-text-label-text-color: var(--mat-datepicker-calendar-period-button-text-color, var(--mat-sys-on-surface-variant));
}

.mat-calendar-arrow {
  display: inline-block;
  width: 10px;
  height: 5px;
  margin: 0 0 0 5px;
  vertical-align: middle;
  fill: var(--mat-datepicker-calendar-period-button-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-calendar-arrow.mat-calendar-invert {
  transform: rotate(180deg);
}
[dir=rtl] .mat-calendar-arrow {
  margin: 0 5px 0 0;
}
@media (forced-colors: active) {
  .mat-calendar-arrow {
    fill: CanvasText;
  }
}

.mat-datepicker-content .mat-calendar-previous-button:not(.mat-mdc-button-disabled),
.mat-datepicker-content .mat-calendar-next-button:not(.mat-mdc-button-disabled) {
  color: var(--mat-datepicker-calendar-navigation-button-icon-color, var(--mat-sys-on-surface-variant));
}
[dir=rtl] .mat-calendar-previous-button,
[dir=rtl] .mat-calendar-next-button {
  transform: rotate(180deg);
}

.mat-calendar-table {
  border-spacing: 0;
  border-collapse: collapse;
  width: 100%;
}

.mat-calendar-table-header th {
  text-align: center;
  padding: 0 0 8px 0;
  color: var(--mat-datepicker-calendar-header-text-color, var(--mat-sys-on-surface-variant));
  font-size: var(--mat-datepicker-calendar-header-text-size, var(--mat-sys-title-small-size));
  font-weight: var(--mat-datepicker-calendar-header-text-weight, var(--mat-sys-title-small-weight));
}

.mat-calendar-table-header-divider {
  position: relative;
  height: 1px;
}
.mat-calendar-table-header-divider::after {
  content: "";
  position: absolute;
  top: 0;
  left: -8px;
  right: -8px;
  height: 1px;
  background: var(--mat-datepicker-calendar-header-divider-color, transparent);
}

.mat-calendar-body-cell-content::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 3px) * -1);
}

.mat-calendar-body-cell:focus-visible .mat-focus-indicator::before {
  content: "";
}
`],encapsulation:2,changeDetection:0})}return i})(),Ea=new Re("mat-datepicker-scroll-strategy",{providedIn:"root",factory:()=>{let i=o(me);return()=>St(i)}}),ea=(()=>{class i{_elementRef=o(U);_animationsDisabled=Ke();_changeDetectorRef=o(R);_globalModel=o(de);_dateAdapter=o(C);_ngZone=o(Oe);_rangeSelectionStrategy=o(Xt,{optional:!0});_stateChanges;_model;_eventCleanups;_animationFallback;_calendar;color;datepicker;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;_isAbove=!1;_animationDone=new O;_isAnimating=!1;_closeButtonText;_closeButtonFocused=!1;_actionsPortal=null;_dialogLabelId=null;constructor(){if(o(te).load(ke),this._closeButtonText=o(G).closeCalendarLabel,!this._animationsDisabled){let e=this._elementRef.nativeElement,a=o(Pe);this._eventCleanups=this._ngZone.runOutsideAngular(()=>[a.listen(e,"animationstart",this._handleAnimationEvent),a.listen(e,"animationend",this._handleAnimationEvent),a.listen(e,"animationcancel",this._handleAnimationEvent)])}}ngAfterViewInit(){this._stateChanges=this.datepicker.stateChanges.subscribe(()=>{this._changeDetectorRef.markForCheck()}),this._calendar.focusActiveCell()}ngOnDestroy(){clearTimeout(this._animationFallback),this._eventCleanups?.forEach(e=>e()),this._stateChanges?.unsubscribe(),this._animationDone.complete()}_handleUserSelection(e){let a=this._model.selection,t=e.value,n=a instanceof A;if(n&&this._rangeSelectionStrategy){let r=this._rangeSelectionStrategy.selectionFinished(t,a,e.event);this._model.updateSelection(r,this)}else t&&(n||!this._dateAdapter.sameDate(t,a))&&this._model.add(t);(!this._model||this._model.isComplete())&&!this._actionsPortal&&this.datepicker.close()}_handleUserDragDrop(e){this._model.updateSelection(e.value,this)}_startExitAnimation(){this._elementRef.nativeElement.classList.add("mat-datepicker-content-exit"),this._animationsDisabled?this._animationDone.next():(clearTimeout(this._animationFallback),this._animationFallback=setTimeout(()=>{this._isAnimating||this._animationDone.next()},200))}_handleAnimationEvent=e=>{let a=this._elementRef.nativeElement;e.target!==a||!e.animationName.startsWith("_mat-datepicker-content")||(clearTimeout(this._animationFallback),this._isAnimating=e.type==="animationstart",a.classList.toggle("mat-datepicker-content-animating",this._isAnimating),this._isAnimating||this._animationDone.next())};_getSelected(){return this._model.selection}_applyPendingSelection(){this._model!==this._globalModel&&this._globalModel.updateSelection(this._model.selection,this)}_assignActions(e,a){this._model=e?this._globalModel.clone():this._globalModel,this._actionsPortal=e,a&&this._changeDetectorRef.detectChanges()}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-datepicker-content"]],viewQuery:function(a,t){if(a&1&&N(Je,5),a&2){let n;E(n=x())&&(t._calendar=n.first)}},hostAttrs:[1,"mat-datepicker-content"],hostVars:6,hostBindings:function(a,t){a&2&&(De(t.color?"mat-"+t.color:""),I("mat-datepicker-content-touch",t.datepicker.touchUi)("mat-datepicker-content-animations-enabled",!t._animationsDisabled))},inputs:{color:"color"},exportAs:["matDatepickerContent"],decls:5,vars:26,consts:[["cdkTrapFocus","","role","dialog",1,"mat-datepicker-content-container"],[3,"yearSelected","monthSelected","viewChanged","_userSelection","_userDragDrop","id","startAt","startView","minDate","maxDate","dateFilter","headerComponent","selected","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName"],[3,"cdkPortalOutlet"],["type","button","matButton","elevated",1,"mat-datepicker-close-button",3,"focus","blur","click","color"]],template:function(a,t){a&1&&(l(0,"div",0)(1,"mat-calendar",1),m("yearSelected",function(r){return t.datepicker._selectYear(r)})("monthSelected",function(r){return t.datepicker._selectMonth(r)})("viewChanged",function(r){return t.datepicker._viewChanged(r)})("_userSelection",function(r){return t._handleUserSelection(r)})("_userDragDrop",function(r){return t._handleUserDragDrop(r)}),p(),Le(2,Da,0,0,"ng-template",2),l(3,"button",3),m("focus",function(){return t._closeButtonFocused=!0})("blur",function(){return t._closeButtonFocused=!1})("click",function(){return t.datepicker.close()}),g(4),p()()),a&2&&(I("mat-datepicker-content-container-with-custom-header",t.datepicker.calendarHeaderComponent)("mat-datepicker-content-container-with-actions",t._actionsPortal),f("aria-modal",!0)("aria-labelledby",t._dialogLabelId??void 0),d(),De(t.datepicker.panelClass),_("id",t.datepicker.id)("startAt",t.datepicker.startAt)("startView",t.datepicker.startView)("minDate",t.datepicker._getMinDate())("maxDate",t.datepicker._getMaxDate())("dateFilter",t.datepicker._getDateFilter())("headerComponent",t.datepicker.calendarHeaderComponent)("selected",t._getSelected())("dateClass",t.datepicker.dateClass)("comparisonStart",t.comparisonStart)("comparisonEnd",t.comparisonEnd)("startDateAccessibleName",t.startDateAccessibleName)("endDateAccessibleName",t.endDateAccessibleName),d(),_("cdkPortalOutlet",t._actionsPortal),d(),I("cdk-visually-hidden",!t._closeButtonFocused),_("color",t.color||"primary"),d(),T(t._closeButtonText))},dependencies:[bt,Je,We,ie],styles:[`@keyframes _mat-datepicker-content-dropdown-enter {
  from {
    opacity: 0;
    transform: scaleY(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes _mat-datepicker-content-dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes _mat-datepicker-content-exit {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
.mat-datepicker-content {
  display: block;
  background-color: var(--mat-datepicker-calendar-container-background-color, var(--mat-sys-surface-container-high));
  color: var(--mat-datepicker-calendar-container-text-color, var(--mat-sys-on-surface));
  box-shadow: var(--mat-datepicker-calendar-container-elevation-shadow, 0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12));
  border-radius: var(--mat-datepicker-calendar-container-shape, var(--mat-sys-corner-large));
}
.mat-datepicker-content.mat-datepicker-content-animations-enabled {
  animation: _mat-datepicker-content-dropdown-enter 120ms cubic-bezier(0, 0, 0.2, 1);
}
.mat-datepicker-content .mat-calendar {
  width: 296px;
  height: 354px;
}
.mat-datepicker-content .mat-datepicker-content-container-with-custom-header .mat-calendar {
  height: auto;
}
.mat-datepicker-content .mat-datepicker-close-button {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
}
.mat-datepicker-content-animating .mat-datepicker-content .mat-datepicker-close-button {
  display: none;
}

.mat-datepicker-content-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mat-datepicker-content-touch {
  display: block;
  max-height: 80vh;
  box-shadow: var(--mat-datepicker-calendar-container-touch-elevation-shadow, 0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12));
  border-radius: var(--mat-datepicker-calendar-container-touch-shape, var(--mat-sys-corner-extra-large));
  position: relative;
  overflow: visible;
  min-height: fit-content;
}
.mat-datepicker-content-touch.mat-datepicker-content-animations-enabled {
  animation: _mat-datepicker-content-dialog-enter 150ms cubic-bezier(0, 0, 0.2, 1);
}
.mat-datepicker-content-touch .mat-datepicker-content-container {
  min-height: 312px;
  max-height: 788px;
  min-width: 250px;
  max-width: 750px;
}
.mat-datepicker-content-touch .mat-calendar {
  width: 100%;
  height: auto;
}

.mat-datepicker-content-exit.mat-datepicker-content-animations-enabled {
  animation: _mat-datepicker-content-exit 100ms linear;
}

@media all and (orientation: landscape) {
  .mat-datepicker-content-touch .mat-datepicker-content-container {
    width: 64vh;
    height: 80vh;
  }
}
@media all and (orientation: portrait) {
  .mat-datepicker-content-touch .mat-datepicker-content-container {
    width: 80vw;
    height: 100vw;
  }
  .mat-datepicker-content-touch .mat-datepicker-content-container-with-actions {
    height: 115vw;
  }
}
`],encapsulation:2,changeDetection:0})}return i})(),Qt=(()=>{class i{_injector=o(me);_viewContainerRef=o(dt);_dateAdapter=o(C,{optional:!0});_dir=o(ae,{optional:!0});_model=o(de);_animationsDisabled=Ke();_scrollStrategy=o(Ea);_inputStateChanges=M.EMPTY;_document=o(st);calendarHeaderComponent;get startAt(){return this._startAt||(this.datepickerInput?this.datepickerInput.getStartValue():null)}set startAt(e){this._startAt=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_startAt=null;startView="month";get color(){return this._color||(this.datepickerInput?this.datepickerInput.getThemePalette():void 0)}set color(e){this._color=e}_color;touchUi=!1;get disabled(){return this._disabled===void 0&&this.datepickerInput?this.datepickerInput.disabled:!!this._disabled}set disabled(e){e!==this._disabled&&(this._disabled=e,this.stateChanges.next(void 0))}_disabled;xPosition="start";yPosition="below";restoreFocus=!0;yearSelected=new c;monthSelected=new c;viewChanged=new c(!0);dateClass;openedStream=new c;closedStream=new c;get panelClass(){return this._panelClass}set panelClass(e){this._panelClass=yt(e)}_panelClass;get opened(){return this._opened}set opened(e){e?this.open():this.close()}_opened=!1;id=o(Ae).getId("mat-datepicker-");_getMinDate(){return this.datepickerInput&&this.datepickerInput.min}_getMaxDate(){return this.datepickerInput&&this.datepickerInput.max}_getDateFilter(){return this.datepickerInput&&this.datepickerInput.dateFilter}_overlayRef=null;_componentRef=null;_focusedElementBeforeOpen=null;_backdropHarnessClass=`${this.id}-backdrop`;_actionsPortal=null;datepickerInput;stateChanges=new O;_changeDetectorRef=o(R);constructor(){this._dateAdapter,this._model.selectionChanged.subscribe(()=>{this._changeDetectorRef.markForCheck()})}ngOnChanges(e){let a=e.xPosition||e.yPosition;if(a&&!a.firstChange&&this._overlayRef){let t=this._overlayRef.getConfig().positionStrategy;t instanceof xt&&(this._setConnectedPositions(t),this.opened&&this._overlayRef.updatePosition())}this.stateChanges.next(void 0)}ngOnDestroy(){this._destroyOverlay(),this.close(),this._inputStateChanges.unsubscribe(),this.stateChanges.complete()}select(e){this._model.add(e)}_selectYear(e){this.yearSelected.emit(e)}_selectMonth(e){this.monthSelected.emit(e)}_viewChanged(e){this.viewChanged.emit(e)}registerInput(e){return this.datepickerInput,this._inputStateChanges.unsubscribe(),this.datepickerInput=e,this._inputStateChanges=e.stateChanges.subscribe(()=>this.stateChanges.next(void 0)),this._model}registerActions(e){this._actionsPortal,this._actionsPortal=e,this._componentRef?.instance._assignActions(e,!0)}removeActions(e){e===this._actionsPortal&&(this._actionsPortal=null,this._componentRef?.instance._assignActions(null,!0))}open(){this._opened||this.disabled||this._componentRef?.instance._isAnimating||(this.datepickerInput,this._focusedElementBeforeOpen=ze(),this._openOverlay(),this._opened=!0,this.openedStream.emit())}close(){if(!this._opened||this._componentRef?.instance._isAnimating)return;let e=this.restoreFocus&&this._focusedElementBeforeOpen&&typeof this._focusedElementBeforeOpen.focus=="function",a=()=>{this._opened&&(this._opened=!1,this.closedStream.emit())};if(this._componentRef){let{instance:t,location:n}=this._componentRef;t._animationDone.pipe(nt(1)).subscribe(()=>{let r=this._document.activeElement;e&&(!r||r===this._document.activeElement||n.nativeElement.contains(r))&&this._focusedElementBeforeOpen.focus(),this._focusedElementBeforeOpen=null,this._destroyOverlay()}),t._startExitAnimation()}e?setTimeout(a):a()}_applyPendingSelection(){this._componentRef?.instance?._applyPendingSelection()}_forwardContentValues(e){e.datepicker=this,e.color=this.color,e._dialogLabelId=this.datepickerInput.getOverlayLabelId(),e._assignActions(this._actionsPortal,!1)}_openOverlay(){this._destroyOverlay();let e=this.touchUi,a=new je(ea,this._viewContainerRef),t=this._overlayRef=Ft(this._injector,new Vt({positionStrategy:e?this._getDialogStrategy():this._getDropdownStrategy(),hasBackdrop:!0,backdropClass:[e?"cdk-overlay-dark-backdrop":"mat-overlay-transparent-backdrop",this._backdropHarnessClass],direction:this._dir||"ltr",scrollStrategy:e?Mt(this._injector):this._scrollStrategy(),panelClass:`mat-datepicker-${e?"dialog":"popup"}`,disableAnimations:this._animationsDisabled}));this._getCloseStream(t).subscribe(n=>{n&&n.preventDefault(),this.close()}),t.keydownEvents().subscribe(n=>{let r=n.keyCode;(r===38||r===40||r===37||r===39||r===33||r===34)&&n.preventDefault()}),this._componentRef=t.attach(a),this._forwardContentValues(this._componentRef.instance),e||Ye(()=>{t.updatePosition()},{injector:this._injector})}_destroyOverlay(){this._overlayRef&&(this._overlayRef.dispose(),this._overlayRef=this._componentRef=null)}_getDialogStrategy(){return It(this._injector).centerHorizontally().centerVertically()}_getDropdownStrategy(){let e=Et(this._injector,this.datepickerInput.getConnectedOverlayOrigin()).withTransformOriginOn(".mat-datepicker-content").withFlexibleDimensions(!1).withViewportMargin(8).withLockedPosition();return this._setConnectedPositions(e)}_setConnectedPositions(e){let a=this.xPosition==="end"?"end":"start",t=a==="start"?"end":"start",n=this.yPosition==="above"?"bottom":"top",r=n==="top"?"bottom":"top";return e.withPositions([{originX:a,originY:r,overlayX:a,overlayY:n},{originX:a,originY:n,overlayX:a,overlayY:r},{originX:t,originY:r,overlayX:t,overlayY:n},{originX:t,originY:n,overlayX:t,overlayY:r}])}_getCloseStream(e){let a=["ctrlKey","shiftKey","metaKey"];return pe(e.backdropClick(),e.detachments(),e.keydownEvents().pipe(at(t=>t.keyCode===27&&!H(t)||this.datepickerInput&&H(t,"altKey")&&t.keyCode===38&&a.every(n=>!H(t,n)))))}static \u0275fac=function(a){return new(a||i)};static \u0275dir=$({type:i,inputs:{calendarHeaderComponent:"calendarHeaderComponent",startAt:"startAt",startView:"startView",color:"color",touchUi:[2,"touchUi","touchUi",B],disabled:[2,"disabled","disabled",B],xPosition:"xPosition",yPosition:"yPosition",restoreFocus:[2,"restoreFocus","restoreFocus",B],dateClass:"dateClass",panelClass:"panelClass",opened:[2,"opened","opened",B]},outputs:{yearSelected:"yearSelected",monthSelected:"monthSelected",viewChanged:"viewChanged",openedStream:"opened",closedStream:"closed"},features:[P]})}return i})(),wn=(()=>{class i extends Qt{static \u0275fac=(()=>{let e;return function(t){return(e||(e=_e(i)))(t||i)}})();static \u0275cmp=k({type:i,selectors:[["mat-datepicker"]],exportAs:["matDatepicker"],features:[we([$t,{provide:Qt,useExisting:i}]),X],decls:0,vars:0,template:function(a,t){},encapsulation:2,changeDetection:0})}return i})(),j=class{target;targetElement;value=null;constructor(s,e){this.target=s,this.targetElement=e,this.value=this.target.value}},xa=(()=>{class i{_elementRef=o(U);_dateAdapter=o(C,{optional:!0});_dateFormats=o(K,{optional:!0});_isInitialized=!1;get value(){return this._model?this._getValueFromModel(this._model.selection):this._pendingValue}set value(e){this._assignValueProgrammatically(e,!0)}_model;get disabled(){return!!this._disabled||this._parentDisabled()}set disabled(e){let a=e,t=this._elementRef.nativeElement;this._disabled!==a&&(this._disabled=a,this.stateChanges.next(void 0)),a&&this._isInitialized&&t.blur&&t.blur()}_disabled;dateChange=new c;dateInput=new c;stateChanges=new O;_onTouched=()=>{};_validatorOnChange=()=>{};_cvaOnChange=()=>{};_valueChangesSubscription=M.EMPTY;_localeSubscription=M.EMPTY;_pendingValue=null;_parseValidator=()=>this._lastValueValid?null:{matDatepickerParse:{text:this._elementRef.nativeElement.value}};_filterValidator=e=>{let a=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value));return!a||this._matchesFilter(a)?null:{matDatepickerFilter:!0}};_minValidator=e=>{let a=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),t=this._getMinDate();return!t||!a||this._dateAdapter.compareDate(t,a)<=0?null:{matDatepickerMin:{min:t,actual:a}}};_maxValidator=e=>{let a=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),t=this._getMaxDate();return!t||!a||this._dateAdapter.compareDate(t,a)>=0?null:{matDatepickerMax:{max:t,actual:a}}};_getValidators(){return[this._parseValidator,this._minValidator,this._maxValidator,this._filterValidator]}_registerModel(e){this._model=e,this._valueChangesSubscription.unsubscribe(),this._pendingValue&&this._assignValue(this._pendingValue),this._valueChangesSubscription=this._model.selectionChanged.subscribe(a=>{if(this._shouldHandleChangeEvent(a)){let t=this._getValueFromModel(a.selection);this._lastValueValid=this._isValidValue(t),this._cvaOnChange(t),this._onTouched(),this._formatValue(t),this.dateInput.emit(new j(this,this._elementRef.nativeElement)),this.dateChange.emit(new j(this,this._elementRef.nativeElement))}})}_lastValueValid=!1;constructor(){this._localeSubscription=this._dateAdapter.localeChanges.subscribe(()=>{this._assignValueProgrammatically(this.value,!0)})}ngAfterViewInit(){this._isInitialized=!0}ngOnChanges(e){Ia(e,this._dateAdapter)&&this.stateChanges.next(void 0)}ngOnDestroy(){this._valueChangesSubscription.unsubscribe(),this._localeSubscription.unsubscribe(),this.stateChanges.complete()}registerOnValidatorChange(e){this._validatorOnChange=e}validate(e){return this._validator?this._validator(e):null}writeValue(e){this._assignValueProgrammatically(e,e!==this.value)}registerOnChange(e){this._cvaOnChange=e}registerOnTouched(e){this._onTouched=e}setDisabledState(e){this.disabled=e}_onKeydown(e){let a=["ctrlKey","shiftKey","metaKey"];H(e,"altKey")&&e.keyCode===40&&a.every(n=>!H(e,n))&&!this._elementRef.nativeElement.readOnly&&(this._openPopup(),e.preventDefault())}_onInput(e){let a=e.target.value,t=this._lastValueValid,n=this._dateAdapter.parse(a,this._dateFormats.parse.dateInput);this._lastValueValid=this._isValidValue(n),n=this._dateAdapter.getValidDateOrNull(n);let r=!this._dateAdapter.sameDate(n,this.value);!n||r?this._cvaOnChange(n):(a&&!this.value&&this._cvaOnChange(n),t!==this._lastValueValid&&this._validatorOnChange()),r&&(this._assignValue(n),this.dateInput.emit(new j(this,this._elementRef.nativeElement)))}_onChange(){this.dateChange.emit(new j(this,this._elementRef.nativeElement))}_onBlur(){this.value&&this._formatValue(this.value),this._onTouched()}_formatValue(e){this._elementRef.nativeElement.value=e!=null?this._dateAdapter.format(e,this._dateFormats.display.dateInput):""}_assignValue(e){this._model?(this._assignValueToModel(e),this._pendingValue=null):this._pendingValue=e}_isValidValue(e){return!e||this._dateAdapter.isValid(e)}_parentDisabled(){return!1}_assignValueProgrammatically(e,a){e=this._dateAdapter.deserialize(e),this._lastValueValid=this._isValidValue(e),e=this._dateAdapter.getValidDateOrNull(e),this._assignValue(e),a&&this._formatValue(e)}_matchesFilter(e){let a=this._getDateFilter();return!a||a(e)}static \u0275fac=function(a){return new(a||i)};static \u0275dir=$({type:i,inputs:{value:"value",disabled:[2,"disabled","disabled",B]},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[P]})}return i})();function Ia(i,s){let e=Object.keys(i);for(let a of e){let{previousValue:t,currentValue:n}=i[a];if(s.isDateInstance(t)&&s.isDateInstance(n)){if(!s.sameDate(t,n))return!0}else return!0}return!1}var Fa={provide:Rt,useExisting:Te(()=>ta),multi:!0},Ta={provide:Ot,useExisting:Te(()=>ta),multi:!0},ta=(()=>{class i extends xa{_formField=o(Ct,{optional:!0});_closedSubscription=M.EMPTY;_openedSubscription=M.EMPTY;set matDatepicker(e){e&&(this._datepicker=e,this._ariaOwns.set(e.opened?e.id:null),this._closedSubscription=e.closedStream.subscribe(()=>{this._onTouched(),this._ariaOwns.set(null)}),this._openedSubscription=e.openedStream.subscribe(()=>{this._ariaOwns.set(e.id)}),this._registerModel(e.registerInput(this)))}_datepicker;_ariaOwns=h(null);get min(){return this._min}set min(e){let a=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(a,this._min)||(this._min=a,this._validatorOnChange())}_min=null;get max(){return this._max}set max(e){let a=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(a,this._max)||(this._max=a,this._validatorOnChange())}_max=null;get dateFilter(){return this._dateFilter}set dateFilter(e){let a=this._matchesFilter(this.value);this._dateFilter=e,this._matchesFilter(this.value)!==a&&this._validatorOnChange()}_dateFilter;_validator=null;constructor(){super(),this._validator=Yt.compose(super._getValidators())}getConnectedOverlayOrigin(){return this._formField?this._formField.getConnectedOverlayOrigin():this._elementRef}getOverlayLabelId(){return this._formField?this._formField.getLabelId():this._elementRef.nativeElement.getAttribute("aria-labelledby")}getThemePalette(){return this._formField?this._formField.color:void 0}getStartValue(){return this.value}ngOnDestroy(){super.ngOnDestroy(),this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe()}_openPopup(){this._datepicker&&this._datepicker.open()}_getValueFromModel(e){return e}_assignValueToModel(e){this._model&&this._model.updateSelection(e,this)}_getMinDate(){return this._min}_getMaxDate(){return this._max}_getDateFilter(){return this._dateFilter}_shouldHandleChangeEvent(e){return e.source!==this}static \u0275fac=function(a){return new(a||i)};static \u0275dir=$({type:i,selectors:[["input","matDatepicker",""]],hostAttrs:[1,"mat-datepicker-input"],hostVars:6,hostBindings:function(a,t){a&1&&m("input",function(r){return t._onInput(r)})("change",function(){return t._onChange()})("blur",function(){return t._onBlur()})("keydown",function(r){return t._onKeydown(r)}),a&2&&(L("disabled",t.disabled),f("aria-haspopup",t._datepicker?"dialog":null)("aria-owns",t._ariaOwns())("min",t.min?t._dateAdapter.toIso8601(t.min):null)("max",t.max?t._dateAdapter.toIso8601(t.max):null)("data-mat-calendar",t._datepicker?t._datepicker.id:null))},inputs:{matDatepicker:"matDatepicker",min:"min",max:"max",dateFilter:[0,"matDatepickerFilter","dateFilter"]},exportAs:["matDatepickerInput"],features:[we([Fa,Ta,{provide:Nt,useExisting:i}]),X]})}return i})(),Ra=(()=>{class i{static \u0275fac=function(a){return new(a||i)};static \u0275dir=$({type:i,selectors:[["","matDatepickerToggleIcon",""]]})}return i})(),Oa=(()=>{class i{_intl=o(G);_changeDetectorRef=o(R);_stateChanges=M.EMPTY;datepicker;tabIndex=null;ariaLabel;get disabled(){return this._disabled===void 0&&this.datepicker?this.datepicker.disabled:!!this._disabled}set disabled(e){this._disabled=e}_disabled;disableRipple=!1;_customIcon;_button;constructor(){let e=o(new _t("tabindex"),{optional:!0}),a=Number(e);this.tabIndex=a||a===0?a:null}ngOnChanges(e){e.datepicker&&this._watchStateChanges()}ngOnDestroy(){this._stateChanges.unsubscribe()}ngAfterContentInit(){this._watchStateChanges()}_open(e){this.datepicker&&!this.disabled&&(this.datepicker.open(),e.stopPropagation())}_watchStateChanges(){let e=this.datepicker?this.datepicker.stateChanges:ce(),a=this.datepicker&&this.datepicker.datepickerInput?this.datepicker.datepickerInput.stateChanges:ce(),t=this.datepicker?pe(this.datepicker.openedStream,this.datepicker.closedStream):ce();this._stateChanges.unsubscribe(),this._stateChanges=pe(this._intl.changes,e,a,t).subscribe(()=>this._changeDetectorRef.markForCheck())}static \u0275fac=function(a){return new(a||i)};static \u0275cmp=k({type:i,selectors:[["mat-datepicker-toggle"]],contentQueries:function(a,t,n){if(a&1&&ht(n,Ra,5),a&2){let r;E(r=x())&&(t._customIcon=r.first)}},viewQuery:function(a,t){if(a&1&&N(va,5),a&2){let n;E(n=x())&&(t._button=n.first)}},hostAttrs:[1,"mat-datepicker-toggle"],hostVars:8,hostBindings:function(a,t){a&1&&m("click",function(r){return t._open(r)}),a&2&&(f("tabindex",null)("data-mat-calendar",t.datepicker?t.datepicker.id:null),I("mat-datepicker-toggle-active",t.datepicker&&t.datepicker.opened)("mat-accent",t.datepicker&&t.datepicker.color==="accent")("mat-warn",t.datepicker&&t.datepicker.color==="warn"))},inputs:{datepicker:[0,"for","datepicker"],tabIndex:"tabIndex",ariaLabel:[0,"aria-label","ariaLabel"],disabled:[2,"disabled","disabled",B],disableRipple:"disableRipple"},exportAs:["matDatepickerToggle"],features:[P],ngContentSelectors:Ca,decls:4,vars:7,consts:[["button",""],["matIconButton","","type","button",3,"tabIndex","disabled","disableRipple"],["viewBox","0 0 24 24","width","24px","height","24px","fill","currentColor","focusable","false","aria-hidden","true",1,"mat-datepicker-toggle-default-icon"],["d","M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"]],template:function(a,t){a&1&&(Ne(ya),l(0,"button",1,0),Z(2,wa,2,0,":svg:svg",2),Be(3),p()),a&2&&(_("tabIndex",t.disabled?-1:t.tabIndex)("disabled",t.disabled)("disableRipple",t.disableRipple),f("aria-haspopup",t.datepicker?"dialog":null)("aria-label",t.ariaLabel||t._intl.openCalendarLabel)("aria-expanded",t.datepicker?t.datepicker.opened:null),d(2),J(t._customIcon?-1:2))},dependencies:[ne],styles:[`.mat-datepicker-toggle {
  pointer-events: auto;
  color: var(--mat-datepicker-toggle-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-datepicker-toggle button {
  color: inherit;
}

.mat-datepicker-toggle-active {
  color: var(--mat-datepicker-toggle-active-state-icon-color, var(--mat-sys-primary));
}

@media (forced-colors: active) {
  .mat-datepicker-toggle-default-icon {
    color: CanvasText;
  }
}
`],encapsulation:2,changeDetection:0})}return i})();var kn=(()=>{class i{static \u0275fac=function(a){return new(a||i)};static \u0275mod=lt({type:i});static \u0275inj=it({providers:[G],imports:[Me,Tt,Dt,At,ea,Oa,Fe,vt,kt]})}return i})();var aa=class i extends Fe{dateAdapter=o(C);goToToday(){let s=this.dateAdapter.today();this.calendar.activeDate=s,this.calendar.selectedChange.emit(s);let e={value:s,event:new Event("click")};this.calendar._userSelection.emit(e)}static \u0275fac=(()=>{let s;return function(a){return(s||(s=_e(i)))(a||i)}})();static \u0275cmp=k({type:i,selectors:[["coms-datepicker-today-header"]],features:[X],decls:20,vars:11,consts:[[1,"mat-calendar-header","coms-today-header"],[1,"mat-calendar-controls"],["mat-button","","type","button","aria-live","polite",1,"mat-calendar-period-button",3,"click"],["aria-hidden","true"],["viewBox","0 0 10 5","focusable","false","aria-hidden","true",1,"mat-calendar-arrow"],["points","0,0 5,5 10,0"],[1,"mat-calendar-spacer"],["mat-icon-button","","type","button",1,"mat-calendar-previous-button",3,"click","disabled"],["viewBox","0 0 24 24","focusable","false","aria-hidden","true"],["d","M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],["mat-icon-button","","type","button",1,"mat-calendar-next-button",3,"click","disabled"],["d","M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"],["mat-stroked-button","","type","button",1,"coms-today-header__btn",3,"click"]],template:function(e,a){e&1&&(l(0,"div",0)(1,"div",1)(2,"button",2),m("click",function(){return a.currentPeriodClicked()}),l(3,"span",3),g(4),p(),F(),l(5,"svg",4),D(6,"polygon",5),p()(),Y(),D(7,"div",6),l(8,"button",7),m("click",function(){return a.previousClicked()}),F(),l(9,"svg",8),D(10,"path",9),p()(),Y(),l(11,"button",10),m("click",function(){return a.nextClicked()}),F(),l(12,"svg",8),D(13,"path",11),p()()(),Y(),l(14,"button",12),m("click",function(){return a.goToToday()}),l(15,"mat-icon"),g(16,"today"),p(),l(17,"span"),g(18),ut(19,"translate"),p()()()),e&2&&(d(2),f("aria-label",a.periodButtonLabel),d(2),T(a.periodButtonText),d(),I("mat-calendar-invert",a.calendar.currentView!=="month"),d(3),_("disabled",!a.previousEnabled()),f("aria-label",a.prevButtonLabel),d(3),_("disabled",!a.nextEnabled()),f("aria-label",a.nextButtonLabel),d(7),T(mt(19,9,"common.today")))},dependencies:[Me,ie,ne,Ht,Bt,Lt],styles:[`.coms-today-header{display:flex;flex-direction:column}.coms-today-header__btn{display:flex;align-items:center;justify-content:center;gap:6px;align-self:center;margin:4px 0 10px;min-width:120px;height:34px;padding:0 16px;border-radius:999px;border:1px solid var(--coms-border);background:var(--coms-surface);color:var(--coms-color-primary);font-size:12.5px;font-weight:600;letter-spacing:.01em;line-height:1;transition:all var(--coms-transition-fast);box-shadow:var(--coms-shadow-xs)}.coms-today-header__btn:hover{background:color-mix(in srgb,var(--coms-color-primary) 8%,var(--coms-surface));border-color:var(--coms-color-primary);box-shadow:var(--coms-shadow-sm);transform:translateY(-1px)}.coms-today-header__btn mat-icon{font-size:16px;width:16px;height:16px;color:var(--coms-color-gold)}
`],encapsulation:2})};export{wn as a,ta as b,Oa as c,kn as d,aa as e};
