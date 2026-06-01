(window.webpackJsonp=window.webpackJsonp||[]).push([[28],{"6CCp":function(tn,Te,w){"use strict";w.d(Te,"a",function(){return p});var p=function(l){return l.PreviewReady="preview-ready",l.DetailChange="detail-change",l.MenuChange="menu-change",l.QueryMenu="query-menu",l.QueryDetail="query-detail",l}({})},B5yi:function(tn,Te,w){"use strict";var p=w("+L6B"),l=w("2/Rp"),rn=w("bbsP"),Ie=w("/wGt"),ke=w("tJVT"),T=w("q1tI"),De=w.n(T),bn=w("LvDl"),En=w.n(bn),Ye=w("6CCp"),Qn=w("KVLs"),Re=w.n(Qn);Te.a=Sn=>{var un,I=Sn.Page,Ae=Object(T.useState)({}),Qe=Object(ke.a)(Ae,2),Je=Qe[1],sn=Object(T.useState)(!1),xn=Object(ke.a)(sn,2),_n=xn[0],Ze=xn[1],Tn=Object(T.useState)(""),In=Object(ke.a)(Tn,2),At=In[0],Dn=In[1],gn=Object(T.useRef)();Object(T.useLayoutEffect)(()=>{window.DXYJSBridge={invoke:(je,Ve)=>{switch(je){case"dataTransfer":var on=(Ve==null?void 0:Ve.menu)||[];window.parent&&window.parent.postMessage({source:Ye.a.MenuChange,payload:on},window.location.origin),gn.current=on,Je({});break;case"redirectOutline":Dn(Ve==null?void 0:Ve.outline);break;case"openMenuModal":Ze(!0);break;default:break}}}},[]);var Jn=Object(T.useState)(null),Ln=Object(ke.a)(Jn,2),yn=Ln[0],qn=Ln[1];return Object(T.useEffect)(()=>{if(window.parent){var je=Ve=>{if(Ve.origin===window.location.origin)try{var on=Ve.data||{},On=on.source,$n=on.payload;switch(On){case Ye.a.DetailChange:qn($n);break;case Ye.a.QueryMenu:window.parent.postMessage({source:Ye.a.MenuChange,payload:gn.current},window.location.origin);break;default:break}}catch(h){console.error(h)}};return window.addEventListener("message",je),window.parent.postMessage({source:Ye.a.PreviewReady},window.location.origin),()=>window.removeEventListener("message",je)}return bn.noop},[]),Object(T.useLayoutEffect)(()=>{window.parent&&(document.documentElement.style.fontSize="16px",document.body.classList.contains(Re.a.iframe)||document.body.classList.add(Re.a.iframe))},[]),yn?De.a.createElement("div",{className:Re.a.preview},De.a.createElement(I,{detail:yn}),De.a.createElement(Ie.a,{visible:_n,closable:!0,placement:"bottom",height:627,onClose:()=>{Ze(!1)}},De.a.createElement("ul",{className:Re.a.menus},(un=gn.current)===null||un===void 0?void 0:un.map(je=>De.a.createElement("li",{key:je.cellId,className:"".concat(Re.a.menu).concat(je.cellId===At?" ".concat(Re.a.actived):""),onClick:()=>{Dn(je.cellId),Ze(!1),typeof window.goto=="function"&&window.goto(je.cellId)},style:{marginLeft:16*je.level}},je.title)))),De.a.createElement(l.a,{className:Re.a.btn,shape:"circle",type:"primary",onClick:()=>{Ze(!0)}},"\u76EE\u5F55")):null}},KVLs:function(tn,Te,w){tn.exports={iframe:"iframe___3IRV4",preview:"preview___3hPEz",btn:"btn___TPbYU",menus:"menus___3Wy-j",menu:"menu___3k6CS",actived:"actived___OtEhR"}},RnhZ:function(tn,Te,w){var p={"./af":"K/tc","./af.js":"K/tc","./ar":"jnO4","./ar-dz":"o1bE","./ar-dz.js":"o1bE","./ar-kw":"Qj4J","./ar-kw.js":"Qj4J","./ar-ly":"HP3h","./ar-ly.js":"HP3h","./ar-ma":"CoRJ","./ar-ma.js":"CoRJ","./ar-ps":"TJgH","./ar-ps.js":"TJgH","./ar-sa":"gjCT","./ar-sa.js":"gjCT","./ar-tn":"bYM6","./ar-tn.js":"bYM6","./ar.js":"jnO4","./az":"SFxW","./az.js":"SFxW","./be":"H8ED","./be.js":"H8ED","./bg":"hKrs","./bg.js":"hKrs","./bm":"p/rL","./bm.js":"p/rL","./bn":"kEOa","./bn-bd":"loYQ","./bn-bd.js":"loYQ","./bn.js":"kEOa","./bo":"0mo+","./bo.js":"0mo+","./br":"aIdf","./br.js":"aIdf","./bs":"JVSJ","./bs.js":"JVSJ","./ca":"1xZ4","./ca.js":"1xZ4","./cs":"PA2r","./cs.js":"PA2r","./cv":"A+xa","./cv.js":"A+xa","./cy":"l5ep","./cy.js":"l5ep","./da":"DxQv","./da.js":"DxQv","./de":"tGlX","./de-at":"s+uk","./de-at.js":"s+uk","./de-ch":"u3GI","./de-ch.js":"u3GI","./de.js":"tGlX","./dv":"WYrj","./dv.js":"WYrj","./el":"jUeY","./el.js":"jUeY","./en-au":"Dmvi","./en-au.js":"Dmvi","./en-ca":"OIYi","./en-ca.js":"OIYi","./en-gb":"Oaa7","./en-gb.js":"Oaa7","./en-ie":"4dOw","./en-ie.js":"4dOw","./en-il":"czMo","./en-il.js":"czMo","./en-in":"7C5Q","./en-in.js":"7C5Q","./en-nz":"b1Dy","./en-nz.js":"b1Dy","./en-sg":"t+mt","./en-sg.js":"t+mt","./eo":"Zduo","./eo.js":"Zduo","./es":"iYuL","./es-do":"CjzT","./es-do.js":"CjzT","./es-mx":"tbfe","./es-mx.js":"tbfe","./es-us":"Vclq","./es-us.js":"Vclq","./es.js":"iYuL","./et":"7BjC","./et.js":"7BjC","./eu":"D/JM","./eu.js":"D/JM","./fa":"jfSC","./fa.js":"jfSC","./fi":"gekB","./fi.js":"gekB","./fil":"1ppg","./fil.js":"1ppg","./fo":"ByF4","./fo.js":"ByF4","./fr":"nyYc","./fr-ca":"2fjn","./fr-ca.js":"2fjn","./fr-ch":"Dkky","./fr-ch.js":"Dkky","./fr.js":"nyYc","./fy":"cRix","./fy.js":"cRix","./ga":"USCx","./ga.js":"USCx","./gd":"9rRi","./gd.js":"9rRi","./gl":"iEDd","./gl.js":"iEDd","./gom-deva":"qvJo","./gom-deva.js":"qvJo","./gom-latn":"DKr+","./gom-latn.js":"DKr+","./gu":"4MV3","./gu.js":"4MV3","./he":"x6pH","./he.js":"x6pH","./hi":"3E1r","./hi.js":"3E1r","./hr":"S6ln","./hr.js":"S6ln","./hu":"WxRl","./hu.js":"WxRl","./hy-am":"1rYy","./hy-am.js":"1rYy","./id":"UDhR","./id.js":"UDhR","./is":"BVg3","./is.js":"BVg3","./it":"bpih","./it-ch":"bxKX","./it-ch.js":"bxKX","./it.js":"bpih","./ja":"B55N","./ja.js":"B55N","./jv":"tUCv","./jv.js":"tUCv","./ka":"IBtZ","./ka.js":"IBtZ","./kk":"bXm7","./kk.js":"bXm7","./km":"6B0Y","./km.js":"6B0Y","./kn":"PpIw","./kn.js":"PpIw","./ko":"Ivi+","./ko.js":"Ivi+","./ku":"JCF/","./ku-kmr":"dVgr","./ku-kmr.js":"dVgr","./ku.js":"JCF/","./ky":"lgnt","./ky.js":"lgnt","./lb":"RAwQ","./lb.js":"RAwQ","./lo":"sp3z","./lo.js":"sp3z","./lt":"JvlW","./lt.js":"JvlW","./lv":"uXwI","./lv.js":"uXwI","./me":"KTz0","./me.js":"KTz0","./mi":"aIsn","./mi.js":"aIsn","./mk":"aQkU","./mk.js":"aQkU","./ml":"AvvY","./ml.js":"AvvY","./mn":"lYtQ","./mn.js":"lYtQ","./mr":"Ob0Z","./mr.js":"Ob0Z","./ms":"6+QB","./ms-my":"ZAMP","./ms-my.js":"ZAMP","./ms.js":"6+QB","./mt":"G0Uy","./mt.js":"G0Uy","./my":"honF","./my.js":"honF","./nb":"bOMt","./nb.js":"bOMt","./ne":"OjkT","./ne.js":"OjkT","./nl":"+s0g","./nl-be":"2ykv","./nl-be.js":"2ykv","./nl.js":"+s0g","./nn":"uEye","./nn.js":"uEye","./oc-lnc":"Fnuy","./oc-lnc.js":"Fnuy","./pa-in":"8/+R","./pa-in.js":"8/+R","./pl":"jVdC","./pl.js":"jVdC","./pt":"8mBD","./pt-br":"0tRk","./pt-br.js":"0tRk","./pt.js":"8mBD","./ro":"lyxo","./ro.js":"lyxo","./ru":"lXzo","./ru.js":"lXzo","./sd":"Z4QM","./sd.js":"Z4QM","./se":"//9w","./se.js":"//9w","./si":"7aV9","./si.js":"7aV9","./sk":"e+ae","./sk.js":"e+ae","./sl":"gVVK","./sl.js":"gVVK","./sq":"yPMs","./sq.js":"yPMs","./sr":"zx6S","./sr-cyrl":"E+lV","./sr-cyrl.js":"E+lV","./sr.js":"zx6S","./ss":"Ur1D","./ss.js":"Ur1D","./sv":"X709","./sv.js":"X709","./sw":"dNwA","./sw.js":"dNwA","./ta":"PeUW","./ta.js":"PeUW","./te":"XLvN","./te.js":"XLvN","./tet":"V2x9","./tet.js":"V2x9","./tg":"Oxv6","./tg.js":"Oxv6","./th":"EOgW","./th.js":"EOgW","./tk":"Wv91","./tk.js":"Wv91","./tl-ph":"Dzi0","./tl-ph.js":"Dzi0","./tlh":"z3Vd","./tlh.js":"z3Vd","./tr":"DoHr","./tr.js":"DoHr","./tzl":"z1FC","./tzl.js":"z1FC","./tzm":"wQk9","./tzm-latn":"tT3J","./tzm-latn.js":"tT3J","./tzm.js":"wQk9","./ug-cn":"YRex","./ug-cn.js":"YRex","./uk":"raLr","./uk.js":"raLr","./ur":"UpQW","./ur.js":"UpQW","./uz":"Loxo","./uz-latn":"AQ68","./uz-latn.js":"AQ68","./uz.js":"Loxo","./vi":"KSF8","./vi.js":"KSF8","./x-pseudo":"/X5v","./x-pseudo.js":"/X5v","./yo":"fzPg","./yo.js":"fzPg","./zh-cn":"XDpg","./zh-cn.js":"XDpg","./zh-hk":"SatO","./zh-hk.js":"SatO","./zh-mo":"OmwH","./zh-mo.js":"OmwH","./zh-tw":"kOpN","./zh-tw.js":"kOpN"};function l(Ie){var ke=rn(Ie);return w(ke)}function rn(Ie){if(!w.o(p,Ie)){var ke=new Error("Cannot find module '"+Ie+"'");throw ke.code="MODULE_NOT_FOUND",ke}return p[Ie]}l.keys=function(){return Object.keys(p)},l.resolve=rn,tn.exports=l,l.id="RnhZ"},YpV6:function(tn,Te,w){"use strict";w.d(Te,"a",function(){return yr}),w.d(Te,"b",function(){return vt});var p=w("q1tI"),l=w.n(p),rn=w("b1Yu"),Ie=w.n(rn),ke=w("EVdn"),T=w.n(ke),De=w("ZpRC"),bn=w("wd/R"),En=w.n(bn),Ye=w("4CIP"),Qn=w.n(Ye),Re=w("AsUd"),Sn=w("DMLV"),un=w("TSYQ"),I=w.n(un),Ae=w("9ibs"),Qe=w("YVRJ"),Je=w("A3Ac"),sn=w("FvSR"),xn=w.n(sn),_n=w("HIsj"),Ze=w("i8i4"),Tn=w.n(Ze),In=w("Wr5T"),At=w.n(In),Dn=w("wOnQ"),gn=w.n(Dn),Jn=w("sEfC"),Ln=w.n(Jn),yn=w("z9qM"),qn=w("bdgK"),je=w("VOrJ"),Ve=w.n(je),on={exports:{}};(function(o){function e(n){return o.exports=e=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(i){return typeof i}:function(i){return i&&typeof Symbol=="function"&&i.constructor===Symbol&&i!==Symbol.prototype?"symbol":typeof i},o.exports.__esModule=!0,o.exports.default=o.exports,e(n)}o.exports=e,o.exports.__esModule=!0,o.exports.default=o.exports})(on);var On=function(e,n){return On=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(i,t){i.__proto__=t}||function(i,t){for(var r in t)Object.prototype.hasOwnProperty.call(t,r)&&(i[r]=t[r])},On(e,n)};function $n(o,e){if(typeof e!="function"&&e!==null)throw new TypeError("Class extends value "+String(e)+" is not a constructor or null");On(o,e);function n(){this.constructor=o}o.prototype=e===null?Object.create(e):(n.prototype=e.prototype,new n)}var h=function(){return h=Object.assign||function(n){for(var i,t=1,r=arguments.length;t<r;t++){i=arguments[t];for(var a in i)Object.prototype.hasOwnProperty.call(i,a)&&(n[a]=i[a])}return n},h.apply(this,arguments)};function Ge(o,e){var n={};for(var i in o)Object.prototype.hasOwnProperty.call(o,i)&&e.indexOf(i)<0&&(n[i]=o[i]);if(o!=null&&typeof Object.getOwnPropertySymbols=="function")for(var t=0,i=Object.getOwnPropertySymbols(o);t<i.length;t++)e.indexOf(i[t])<0&&Object.prototype.propertyIsEnumerable.call(o,i[t])&&(n[i[t]]=o[i[t]]);return n}function C(o,e,n,i){function t(r){return r instanceof n?r:new n(function(a){a(r)})}return new(n||(n=Promise))(function(r,a){function d(c){try{u(i.next(c))}catch(m){a(m)}}function s(c){try{u(i.throw(c))}catch(m){a(m)}}function u(c){c.done?r(c.value):t(c.value).then(d,s)}u((i=i.apply(o,e||[])).next())})}function X(o,e){var n={label:0,sent:function(){if(r[0]&1)throw r[1];return r[1]},trys:[],ops:[]},i,t,r,a;return a={next:d(0),throw:d(1),return:d(2)},typeof Symbol=="function"&&(a[Symbol.iterator]=function(){return this}),a;function d(u){return function(c){return s([u,c])}}function s(u){if(i)throw new TypeError("Generator is already executing.");for(;a&&(a=0,u[0]&&(n=0)),n;)try{if(i=1,t&&(r=u[0]&2?t.return:u[0]?t.throw||((r=t.return)&&r.call(t),0):t.next)&&!(r=r.call(t,u[1])).done)return r;switch(t=0,r&&(u=[u[0]&2,r.value]),u[0]){case 0:case 1:r=u;break;case 4:return n.label++,{value:u[1],done:!1};case 5:n.label++,t=u[1],u=[0];continue;case 7:u=n.ops.pop(),n.trys.pop();continue;default:if(r=n.trys,!(r=r.length>0&&r[r.length-1])&&(u[0]===6||u[0]===2)){n=0;continue}if(u[0]===3&&(!r||u[1]>r[0]&&u[1]<r[3])){n.label=u[1];break}if(u[0]===6&&n.label<r[1]){n.label=r[1],r=u;break}if(r&&n.label<r[2]){n.label=r[2],n.ops.push(u);break}r[2]&&n.ops.pop(),n.trys.pop();continue}u=e.call(o,n)}catch(c){u=[6,c],t=0}finally{i=r=0}if(u[0]&5)throw u[1];return{value:u[0]?u[1]:void 0,done:!0}}}function Wn(o,e,n){if(n||arguments.length===2)for(var i=0,t=e.length,r;i<t;i++)(r||!(i in e))&&(r||(r=Array.prototype.slice.call(e,0,i)),r[i]=e[i]);return o.concat(r||Array.prototype.slice.call(e))}typeof SuppressedError=="function"&&SuppressedError;var _,Ht=function(e){return C(void 0,void 0,void 0,function(){return X(this,function(n){return _||(_=new e(window.DXYJSBridge)),[2,_]})})},cn,Ne,ht;(function(o){o[o.TRANSLATED=1]="TRANSLATED",o[o.INTERPRETED=2]="INTERPRETED",o[o.EXPERTED=3]="EXPERTED"})(ht||(ht={}));var et;(function(o){o[o.NONE=0]="NONE",o[o.VIP=1]="VIP",o[o.SVIP=2]="SVIP"})(et||(et={}));var re;(function(o){o.EVIDENCE="1",o.INTERACTION="15",o.DRUG="17",o.CLINICAL="18",o.CALC="19",o.SIGN="31",o.CHECKUP="32",o.FDA="33",o.WESTERN="34",o.EASTERN="35",o.TUMOR="36",o.GUIDE="101",o.GUIDEDETAIL="102",o.ARTICLE="103",o.NEWARTICLE="104",o.PREGNANCY="105",o.NURSE="106",o.AD="201",o.SUPERVISOR="301",o.WEB="1000"})(re||(re={})),cn={},cn[re.CLINICAL]="\u8BCA\u7597\u65B9\u6848",cn[re.GUIDE]="\u6307\u5357",cn[re.ARTICLE]="\u7ECF\u9A8C",cn[re.WEB]="\u5B66\u672F";var mn;(function(o){o[o.SUPERDRUG=49]="SUPERDRUG",o[o.EVIDENCE_SPECIAL=50]="EVIDENCE_SPECIAL",o[o.BLACKWARNING=54]="BLACKWARNING",o[o.PHARMACOLOGY=56]="PHARMACOLOGY",o[o.MASK=64]="MASK",o[o.FREE=70]="FREE",o[o.DURG_SAFE=71]="DURG_SAFE",o[o.CLASSIC=72]="CLASSIC",o[o.FDA=73]="FDA",o[o.NORMALDRUG=75]="NORMALDRUG",o[o.DIRECT_BUY=4011]="DIRECT_BUY",o[o.GUIDE_MASK=80]="GUIDE_MASK"})(mn||(mn={}));var bt;(function(o){o[o.SVIP=1]="SVIP",o[o.VIP=2]="VIP",o[o.UPGRADE=11]="UPGRADE",o[o.BUY=12]="BUY"})(bt||(bt={}));var xt;(function(o){o.EXAM="exam",o.SUPER="superinstruction",o.EBM="ebminfo"})(xt||(xt={}));var ae;(function(o){o[o.OTHER=0]="OTHER",o[o.EVIDENCE=1]="EVIDENCE",o[o.CLINICAL=2]="CLINICAL",o[o.SIGN=3]="SIGN",o[o.CHECKUP=4]="CHECKUP",o[o.GUIDE=5]="GUIDE",o[o.DRUG=6]="DRUG",o[o.DRUGCATEGORY=7]="DRUGCATEGORY",o[o.DrugExperience=8]="DrugExperience",o[o.GuideTopic=9]="GuideTopic",o[o.DxyThread=10]="DxyThread",o[o.Article=11]="Article",o[o.Ad=12]="Ad",o[o.ClinicalTopic=13]="ClinicalTopic",o[o.MiniProgram=14]="MiniProgram",o[o.Calc=15]="Calc",o[o.Tumor=16]="Tumor"})(ae||(ae={}));var Cn;(function(o){o[o.DEV=3]="DEV",o[o.TEST=2]="TEST",o[o.UAT=1]="UAT",o[o.PRD=0]="PRD"})(Cn||(Cn={}));var Xn;(function(o){o[o.DRUG_NOTICE=3]="DRUG_NOTICE",o[o.COMMENT_TIPS=4]="COMMENT_TIPS",o[o.COMMENT=5]="COMMENT"})(Xn||(Xn={}));var Be;(function(o){o[o.COPY=1]="COPY",o[o.COMMENT=2]="COMMENT",o[o.SHARE=4]="SHARE",o[o.FEEDBACK=8]="FEEDBACK"})(Be||(Be={})),Ne={},Ne[re.EVIDENCE]=ae.EVIDENCE,Ne[re.CLINICAL]=ae.CLINICAL,Ne[re.SIGN]=ae.SIGN,Ne[re.CHECKUP]=ae.CHECKUP,Ne[re.GUIDE]=ae.GUIDE,Ne[re.DRUG]=ae.DRUG,Ne[re.ARTICLE]=ae.DrugExperience,Ne[re.NEWARTICLE]=ae.Article,Ne[re.AD]=ae.Ad,Ne[re.CALC]=ae.Calc,Ne[re.TUMOR]=ae.Tumor;var Mt=function(){try{var e=/dxyapp_version\/([^\s]+)/i.exec(navigator.userAgent),n=e&&e[1];return n&&/^\d+\.\d+$/.test(n)?n+".0":n}catch(i){return"0.0.0"}},Rt=function(){return typeof navigator!="undefined"&&/android/i.test(navigator.userAgent)},Zt=function(){return typeof navigator!="undefined"&&/Harmony/i.test(navigator.userAgent)},vn=function(){return typeof navigator!="undefined"&&/dxyapp_name\/clinmaster/i.test(navigator.userAgent)},Hn=function(){return typeof navigator!="undefined"&&/dxyapp_/i.test(navigator.userAgent)&&/drugs/i.test(navigator.userAgent)&&!/idxyer/i.test(navigator.userAgent)},Mn=function(){return typeof navigator!="undefined"?/dxyapp_/i.test(navigator.userAgent)&&/idxyer/i.test(navigator.userAgent):!1},Vt=function(e){var n=En()(),i=En()(e);return i.year()===n.year()?i.format("MM\u6708DD\u65E5"):i.format("YYYY\u5E74MM\u6708DD\u65E5")},nt=function(e){return e?e<1e4?"".concat(e):e<1e5?"".concat(Math.floor(e/1e4),"\u4E07+"):"10\u4E07+":""},Gt=function(e){var n=e==null?void 0:e.split(","),i=[];return n==null||n.forEach(function(t){var r;if(t.includes("-")){var a=((r=t.split("-"))===null||r===void 0?void 0:r.map(Number))||[],d=a[0],s=a[1];if(d&&s)for(var u=d;u<s+1;u++)i.push(u)}else i.push(Number(t))}),i},fn=function(e,n){for(var i=function(u){var c=e.findIndex(function(f){var v;return((v=f.cellId)===null||v===void 0?void 0:v.trim())===(u==null?void 0:u.trim())}),m=e.findIndex(function(f){var v;return((v=f.title)===null||v===void 0?void 0:v.trim())===(u==null?void 0:u.trim())});return c>-1?c:m},t;(t=i(n))===-1;){var r=n.lastIndexOf("&__&");if(r>-1)n=n.substr(0,r);else break}var a=e[t],d=e.length;if(a==null?void 0:a.disabled)for(;t<d&&(a=e[t++])&&a.disabled;);return{cellIndex:t,cell:a}},Bt=function(e,n){var i,t,r;return(r=(t=(i=e.attribs)===null||i===void 0?void 0:i.class)===null||t===void 0?void 0:t.split(" "))===null||r===void 0?void 0:r.includes(n)},gt=function(e){var n,i,t,r,a,d;return e.type==="tag"&&e.name==="a"?((n=e.attribs)===null||n===void 0?void 0:n.href)&&/^https?:\/\/app\.dxy\.cn\/drugs/.test((i=e.attribs)===null||i===void 0?void 0:i.href)?!0:((t=e.attribs)===null||t===void 0?void 0:t["data-type"])&&((a=(r=e.attribs)===null||r===void 0?void 0:r.class)===null||a===void 0?void 0:a.includes("J-redirect"))&&((d=e.attribs)===null||d===void 0?void 0:d["data-status"])!=="pending":!1},Ft=function(e){var n;return e.type==="tag"&&e.name==="span"&&((n=e.attribs)===null||n===void 0?void 0:n["data-href"])||e.name==="cite"&&Bt(e,"link-chart")},Ut=function(e,n){var i=n,t=["/","`","^","-","\xB7","\uFF09","(","\u2014",")"],r=function(x){return/[\u4e00-\u9fa5]/.test(x)},a="".concat(e).split("").map(Number).slice(1),d=a.length;if(d){for(var s=1,u="",c=0,m=0;m<d;m++)if(a[m]!==0){s*=a[m];var f=s;if(s>=i.length)break;for(var v=t[c%t.length],A=0,g=i.length;A<g-1;A++)if(f===0){if(r(i[A+1])&&r(i[A-1])&&i[A]===v){u+=i.substr(0,A),i=i.substr(A+1),c++;break}}else r(i[A])&&(f-=1)}return u+=i,u}return i},Rn=function(e){if(typeof e=="string"&&!/^\d*(\.\d*)?$/.test(e))return"Number is wrong!";for(var n=["\u96F6","\u4E00","\u4E8C","\u4E09","\u56DB","\u4E94","\u516D","\u4E03","\u516B","\u4E5D"],i=["","\u5341","\u767E","\u5343","\u4E07","\u4EBF","\u70B9",""],t="".concat(e).replace(/(^0*)/g,"").split("."),r=0,a="",d=t[0].length-1;d>=0;d--){switch(r){case 0:a=i[7]+a;break;case 4:new RegExp("0{4}\\d{".concat(t[0].length-d-1,"}$")).test(t[0])||(a=i[4]+a);break;case 8:a=i[5]+a,i[7]=i[5],r=0;break}r%4==2&&t[0].charAt(d+2)!=="0"&&t[0].charAt(d+1)==="0"&&(a=n[0]+a),t[0].charAt(d)!=="0"&&(d===0&&t[0].length===2&&t[0].charAt(0)==="1"?a=i[r%4]+a:a=n[t[0].charAt(d)]+i[r%4]+a),r++}if(t.length>1){a+=i[6];for(var d=0;d<t[1].length;d++)a+=n[t[1].charAt(d)]}return a},Kt=function(e){var n="abcdefghijklmnopqrstuvwxyz",i="",t=e-1;if(t<0)return"";if(t===0)return"a";for(;t>0;){var r=t%26;i=n[r]+i,t=Math.floor(t/26)}return i.toLowerCase()},Yt=function(e){var n=[["M",1e3],["CM",900],["D",500],["CD",400],["C",100],["XC",90],["L",50],["XL",40],["X",10],["IX",9],["V",5],["IV",4],["I",1]],i="";return n.forEach(function(t){for(var r=t[0],a=t[1];e>=a;)i+=r,e-=a}),i},Qt=function(e,n){var i=n===void 0?{}:n,t=i.appendIndex,r=t===void 0?!1:t,a=i.level,d=a===void 0?0:a,s=1,u=1,c=e.map(function(m){var f=r||m.data&&m.data.sectionIndex;if(m.type)return m;if(m.level===d)u=1,s=1;else if(m.level===d+1){if(u=1,f){var v="".concat(Rn(s++),"\u3001");return h(h({},m),{title:m.title.indexOf(v)!==0?"".concat(v).concat(m.title):m.title})}}else if(m.level===d+2&&f){var v="(".concat(Rn(u++),") ");return h(h({},m),{title:m.title.indexOf(v)!==0?"".concat(v).concat(m.title):m.title})}return m});return c},Jt=function(e){if(typeof e=="string"){var n=e.indexOf("/drugs.dxy.cn/image/");if(n!==-1){var i=e.split("/");return i[4]="original",i.join("/")}if(e.indexOf("img.dxycdn.com/")!==-1)return e.replace("_small","")}return e!=null?e:""},tt=function(){},Pn=function(e){return/^[.\d]+px$/i.test(e)?+e.replace(/px/,""):0},qt=function(e){for(var n,i=e;i=i.parentElement;)if(i.tagName==="A"&&(((n=i.className)===null||n===void 0?void 0:n.includes("J-redirect"))||i.getAttribute("href")))return!0;return!1},Fe={},an=function(e,n){return Fe[e]||(Fe[e]=[]),Fe[e].push(n),function(){Fe[e]=Fe[e].filter(function(i){return i!==n})}},pn=function(e,n){var i=Fe[e];!Array.isArray(i)||!i.length||(typeof n=="function"?Fe[e]=i.filter(function(t){return t!==n}):Fe[e]=[])},dn=function(e,n){var i=Fe[e];Array.isArray(i)&&i.length&&i.map(function(t){return t(n)})},$t=function(e,n){Re.a(e,{tags:{component:"ErrorCaptureMessage",version:Mt()},extra:n})},it="tabClick",ei="goto",yt="ellpsisResize",rt="changeFontSize",ot="redirectOutline",at="comment_parsed",dt="goto_anchor",Ot="scroll_top",ni=function(){function o(e){this._outline="",this._daTrackParams={},this.eventMap=new Map,this.controller=null,Object({NODE_ENV:"production"}).DXY_DEVTOOLS&&Object(Sn.a)("hybrid","drugs"),this.bridge=e}return o.prototype.getServerData=function(e){var n;return C(this,void 0,void 0,function(){var i,t=this;return X(this,function(r){return!Mn()&&!Hn()&&!vn()?(i=new URLSearchParams(e.params).toString(),[2,fetch("".concat((n=e.url)===null||n===void 0?void 0:n.replace("ai.dxy.cn","ai.dxy.net"),"?").concat(e.method==="GET"?i:""),{method:e.method,body:e.method==="POST"?JSON.stringify(e.params):void 0,headers:{"Content-Type":"application/json"}}).then(function(a){return C(t,void 0,void 0,function(){var d,s,u;return X(this,function(c){switch(c.label){case 0:return[4,a.json()];case 1:return d=c.sent(),(d==null?void 0:d.errorCode)===100049&&typeof window!="undefined"&&window.jsHooks&&((u=(s=window.jsHooks).forbinden)===null||u===void 0||u.call(s)),[2,{data:d}]}})})})]):[2,this.invoke("getServerData",e).then(function(a){var d,s,u;return((d=a==null?void 0:a.data)===null||d===void 0?void 0:d.errorCode)===100049&&typeof window!="undefined"&&window.jsHooks&&((u=(s=window.jsHooks).forbinden)===null||u===void 0||u.call(s)),a})]})})},o.prototype.getStreamData=function(e,n,i){var t=this,r;if(!Mn()&&!Hn()&&!vn()){this.controller=new AbortController;var a=new URLSearchParams(n.params).toString();return fetch("".concat((r=n.url)===null||r===void 0?void 0:r.replace("ai.dxy.cn","ai.dxy.net"),"?").concat(n.method==="GET"?a:""),{method:n.method,body:n.method==="POST"?JSON.stringify(n.params):void 0,headers:{"Content-Type":"application/json"},signal:this.controller.signal}).then(function(d){return C(t,void 0,void 0,function(){var s,u,c,m=this,f;return X(this,function(v){switch(v.label){case 0:return d.ok?(s=(f=d.body)===null||f===void 0?void 0:f.getReader(),u=new TextDecoder,c=function(){return C(m,void 0,void 0,function(){var g=this;return X(this,function(y){return[2,s==null?void 0:s.read().then(function(x){return C(g,void 0,void 0,function(){var j;return X(this,function(R){return x.done?[2]:(j=u.decode(x.value,{stream:!0}),i(j),[2,c()])})})})]})})},[4,c()]):[3,2];case 1:v.sent(),v.label=2;case 2:return[2]}})})}),1}return window.DXYJSBridge.stream(e,n,i)},o.prototype.close=function(e){if(!Mn()&&!Hn()&&!vn())this.controller&&(this.controller.abort(),this.controller=null);else return window.DXYJSBridge.close(e)},o.prototype.invoke=function(e,n){return new Promise(function(i,t){window.DXYJSBridge.invoke(e,n,function(r){return i(r)})})},o.prototype.addEventListener=function(e,n){var i=this;this.eventMap.has(e)||this.eventMap.set(e,[]);var t=this.eventMap.get(e);if((t==null?void 0:t.includes(n))||t==null||t.push(n),typeof window!="undefined"){var r=window.jsHooks||(window.jsHooks={});typeof r[e]=="undefined"&&(r[e]=function(){for(var a=[],d=0;d<arguments.length;d++)a[d]=arguments[d];var s=i.eventMap.get(e);return(s==null?void 0:s.length)===1?s[0].apply(s,a):(s==null?void 0:s.length)?Promise.all(s.map(function(u){return C(i,void 0,void 0,function(){return X(this,function(c){return[2,u.apply(void 0,a)]})})})):Promise.resolve()})}return function(){i.removeEventListener(e,n)}},o.prototype.removeEventListener=function(e,n){var i=this,t=function(){if(i.eventMap.delete(e),typeof window!="undefined"){var s=window.jsHooks;s&&delete s[e]}};if(this.eventMap.has(e)){var r=this.eventMap.get(e);if(n){var a=r==null?void 0:r.filter(function(d){return d!==n});if(a==null?void 0:a.length){this.eventMap.set(e,a);return}}t()}},o}();function ve(o,e){e===void 0&&(e={});var n=e.insertAt;if(!(!o||typeof document=="undefined")){var i=document.head||document.getElementsByTagName("head")[0],t=document.createElement("style");t.type="text/css",n==="top"&&i.firstChild?i.insertBefore(t,i.firstChild):i.appendChild(t),t.styleSheet?t.styleSheet.cssText=o:t.appendChild(document.createTextNode(o))}}var ti=`.common-module_page-search-mark__envDM.common-module_current__H-5El {
  background: orange;
}
`,Zn={"page-search-mark":"common-module_page-search-mark__envDM",current:"common-module_current__H-5El"};ve(ti);var me=function(e){if(typeof e!="string"||!e)return e||"";if(typeof document=="undefined")return e;var n=document.createElement("textarea");return n.innerHTML=e,n.value},Ct=function(e){var n,i,t;return e&&h(h({},e),{basicInfo:e.basicInfo?h(h({},e.basicInfo),{presType:me(e.basicInfo.presType),gender:me(e.basicInfo.gender),ageRaw:me(e.basicInfo.ageRaw),specialPopulationTags:(n=e.basicInfo.specialPopulationTags)===null||n===void 0?void 0:n.map(function(r){return me(r)}),weight:me(e.basicInfo.weight),height:me(e.basicInfo.height),diagnosis:(i=e.basicInfo.diagnosis)===null||i===void 0?void 0:i.map(function(r){return me(r)}),allergyHistory:me(e.basicInfo.allergyHistory)}):e.basicInfo,medications:(t=e.medications)===null||t===void 0?void 0:t.map(function(r){return h(h({},r),{drugName:me(r.drugName),specification:me(r.specification),singleDose:me(r.singleDose),totalQuantity:me(r.totalQuantity),frequency:me(r.frequency),usageRoute:me(r.usageRoute),instruction:me(r.instruction)})})})},ii=function(e){var n,i;return((n=e==null?void 0:e.results)===null||n===void 0?void 0:n.item)?h(h({},e),{results:h(h({},e.results),{item:h(h({},e.results.item),{title:me(e.results.item.title),messages:(i=e.results.item.messages)===null||i===void 0?void 0:i.map(function(t){return h(h({},t),{content:me(t.content),recipeInfo:t.recipeInfo?h(h({},t.recipeInfo),{prescription:Ct(t.recipeInfo.prescription)}):t.recipeInfo})})})})}):e||{}},ri=function(e){var n,i;return((i=(n=e==null?void 0:e.results)===null||n===void 0?void 0:n.items)===null||i===void 0?void 0:i.length)?h(h({},e),{results:h(h({},e.results),{items:e.results.items.map(function(t){return h(h({},t),{title:me(t.title),content:me(t.content),recipeInfo:t.recipeInfo?h(h({},t.recipeInfo),{prescription:Ct(t.recipeInfo.prescription)}):t.recipeInfo})})})}):e||{}},Vn=function(e){var n,i,t;return((n=e==null?void 0:e.results)===null||n===void 0?void 0:n.item)?h(h({},e),{results:h(h({},e.results),{item:h(h({},e.results.item),{medications:(i=e.results.item.medications)===null||i===void 0?void 0:i.map(function(r){return h(h({},r),{drugName:me(r.drugName)})}),children:(t=e.results.item.children)===null||t===void 0?void 0:t.map(function(r){var a;return h(h({},r),{drugs:(a=r.drugs)===null||a===void 0?void 0:a.map(function(d){return h(h({},d),{drugName:me(d.drugName)})})})})})})}):e||{}},oi=function(o){$n(e,o);function e(n){var i=o.call(this,n)||this;return i.init(),i}return e.prototype.setTrackParams=function(n){this._daTrackParams=n},e.prototype.getTrackParams=function(){return this._daTrackParams},e.prototype.init=function(){var n=this,i=new Ie.a(document.querySelector("#root"));window.jsHooks=window.jsHooks||{},window.jsHooks.searchTextInPage=function(t,r){return r===void 0&&(r=0),C(n,void 0,void 0,function(){var a=this;return X(this,function(d){return[2,new Promise(function(s){try{i.unmark({done:function(){var c={exclude:["mark"],className:Zn["page-search-mark"],done:function(f){var v=T()(".".concat(Zn["page-search-mark"]));if(v.removeClass(Zn.current),v.length&&r&&v[r-1]){var A=v[r-1];T()(A).addClass(Zn.current),Object(De.a)(A,{scrollMode:"if-needed"})}s({total:f,index:r})}};t==null||t===""?i.unmark(c):i.mark(t,c)}})}catch(u){s({total:0})}}).then(function(s){return a.searchTextInPageCallback(s),s})]})})},window.getFieldInfo=function(){var t,r,a=function(m){var f=T()(m).parents("[data-menu-anchor]:eq(0)");return f&&T()(f).find("> :header").text()||""},d=(t=window.getSelection())===null||t===void 0?void 0:t.anchorNode,s=(r=window.getSelection())===null||r===void 0?void 0:r.toString(),u=d?a(d):T()("h1").text()||"";n.receiveFieldInfo(h({fieldName:u.replace(/[\n【】]/g,"").trim()},s?{selectText:s}:{}))},window.changeFontSize=function(t){t===void 0&&(t=1);var r=t*16;dn(rt,t),typeof r=="number"&&(document.body.style.fontSize="".concat(r,"px"),document.documentElement.style.fontSize="".concat(r,"px"))},T()("body").on("click",'img:not([data-preview="false"])',function(t){var r=[],a;return qt(t.target)?!0:(T()('img:not([data-preview="false"])').each(function(d,s){r.push(Jt(s.src)),s===t.target&&(a=d)}),n.openGallery({imgUrls:r,imgIndex:a}),!1)}),T()("body").on("click",".J-redirect",function(t){var r=t.currentTarget.innerText,a=h({title:r},t.currentTarget.dataset);t.stopPropagation(),t.preventDefault(),n.redirectCommon(a)}),T()("body").on("click","span[data-href]",function(t){t.stopPropagation(),t.preventDefault();var r=T()(t.currentTarget).attr("data-href");r&&window.goto&&(dn(dt,{cellId:r,target:t.currentTarget}),window.goto(r))})},e.prototype.pageInit=function(){return this.invoke("pageInit",null)},e.prototype.redirectSelectText=function(n){return this.invoke("redirectSelectText",n)},e.prototype.daTrackEvent=function(n){return this.invoke("daTrackEvent",h(h({},n),{userInfo:h(h({},(n==null?void 0:n.userInfo)||{}),{hybrid_version:Object({NODE_ENV:"production"}).HYBRID_VERSION})}))},e.prototype.getNetworkEnv=function(){return this.invoke("getNetworkEnv",{})},e.prototype.updateComments=function(n){return this.invoke("updateComments",n)},e.prototype.setCacheTypeValue=function(n){var i,t=n.key,r=n.value;return this.invoke("setCacheTypeValue",(i={},i[t]=JSON.stringify(r),i))},e.prototype.getCacheTypeValue=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("getCacheTypeValue",{keys:[n]}).then(function(t){var r=t==null?void 0:t[n];try{if(r!==null&&typeof r!="undefined")return JSON.parse(r)}catch(a){return null}})]})})},e.prototype.onClickCorrectGuide=function(){return this.invoke("onClickCorrectGuide",{})},e.prototype.setVisibility=function(n){return this.invoke("setVisibility",n)},e.prototype.redirectLogin=function(n){return this.invoke("redirectLogin",n)},e.prototype.redirectExposeAd=function(n){var i=n.id,t=n.title;return this.invoke("redirectExposeAd",{id:i,title:t})},e.prototype.redirectWebPanel=function(n){return this.invoke("redirectWebPanel",n)},e.prototype.redirectDrugCategory=function(n){return this.invoke("redirectDrugCategory",n)},e.prototype.openMenuModal=function(){return this.invoke("openMenuModal",{})},e.prototype.showGoTopView=function(n){var i=n.show;return this.invoke("showGoTopView",{show:i})},e.prototype.dataTransfer=function(n){var i=n.menu;return this.invoke("dataTransfer",{menu:i})},e.prototype.toggleNavigatorTitle=function(n){return this.invoke("toggleNavigatorTitle",n)},e.prototype.redirectMemberDetail=function(n){return this.invoke("redirectMemberDetail",n)},e.prototype.redirectAuditDetail=function(n){var i=typeof n.id=="number"?"".concat(n.id):n.id;return this.invoke("redirectAuditDetail",h(h({},n),{id:i}))},e.prototype.redirectAuthor=function(n){var i=n.title;return this.invoke("redirectAuthor",{title:i})},e.prototype.redirectProducePrinciple=function(n){var i=n.cellId;return this.invoke("redirectProducePrinciple",{cellId:i})},e.prototype.redirectCommon=function(n){return(n==null?void 0:n.id)&&(n==null?void 0:n.type)===re.ARTICLE?this.invoke("redirectCommon",h(h({},n),{type:re.WEB,url:"https://app.dxy.cn/drugs/nativejump/news/".concat(n.id)})):this.invoke("redirectCommon",n)},e.prototype.redirectPay=function(n){return this.invoke("redirectPay",n)},e.prototype.redirectOutline=function(n){dn(ot,n),n&&this.invoke("redirectOutline",{outline:n})},e.prototype.redirectUpdateRecord=function(n){return this.invoke("redirectUpdateRecord",{entrance:n})},e.prototype.redirectDrugDetailList=function(){return this.invoke("redirectDrugDetailList")},e.prototype.redirectDrugSafeLevel=function(n){return this.invoke("redirectDrugSafeLevel",{type:n})},e.prototype.redirectFromDisease=function(n){var i=n.type,t=n.id;return this.invoke("redirectFromDisease",{id:t,type:i})},e.prototype.redirectRecommendEvidence=function(){return this.invoke("redirectRecommendEvidence")},e.prototype.redirectAdverseEffects=function(){return this.invoke("redirectAdverseEffects")},e.prototype.redirectPharmacokinetic=function(){return this.invoke("redirectPharmacokinetic")},e.prototype.redirectRelatedMedList=function(n){return this.invoke("redirectRelatedMedList",n)},e.prototype.redirectToGuides=function(){return this.invoke("redirectToGuides",null)},e.prototype.searchTextInPageCallback=function(n){return this.invoke("searchTextInPageCallback",n)},e.prototype.receiveFieldInfo=function(n){return this.invoke("receiveFieldInfo",n)},e.prototype.setShareConfig=function(n){return this.invoke("setShareConfig",n).then(function(i){var t;return i.status!=="success"?Promise.reject((t=i.data)===null||t===void 0?void 0:t.message):Promise.resolve(i)})},e.prototype.openGallery=function(n){var i=n.imgUrls,t=n.imgIndex,r=t===void 0?1:t,a=n.titles;return this.invoke("openGallery",{imgUrls:i,imgIndex:r,titles:a})},e.prototype.getAds=function(){return this.invoke("getAds",{}).then(function(n){return n.ads||[]})},e.prototype.clickAd=function(n){return this.invoke("clickAd",{img:n})},e.prototype.queryLiteratureBindList=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("getServerData",{url:"https://newdrugs-dev.dxy.net/app/literature/bind/list",method:"get",params:n}).then(function(t){if(t){var r=t.data||{},a=r.data,d=a===void 0?[]:a,s=r.code;if(s==="success"&&(d==null?void 0:d.length))return t.data}return{code:"fail",data:[]}})]})})},e.prototype.queryArticleDetail=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("getServerData",{url:"https://www.dxy.cn/webservices/article",method:"get",params:{id:n}}).then(function(t){var r;return(r=t==null?void 0:t.data)===null||r===void 0?void 0:r.message})]})})},e.prototype.diggComment=function(n,i){return C(this,void 0,void 0,function(){return X(this,function(t){return[2,this.invoke("getServerData",{url:"https://www.dxy.cn/webservices/comment/".concat(i?"dig":"bury"),method:"put",params:{id:n}}).then(function(r){var a,d,s,u;return((a=r==null?void 0:r.data)===null||a===void 0?void 0:a.success)?(s=(d=r==null?void 0:r.data)===null||d===void 0?void 0:d.message)===null||s===void 0?void 0:s.count:Promise.reject((u=r==null?void 0:r.data)===null||u===void 0?void 0:u.message)})]})})},e.prototype.refComment=function(n){var i=n.id,t=n.username;return C(this,void 0,void 0,function(){return X(this,function(r){return[2,this.invoke("refComment",{id:i,username:t})]})})},e.prototype.queryArticleComment=function(n){var i=n.id,t=n.pageSize,r=n.pageNum;return C(this,void 0,void 0,function(){return X(this,function(a){return[2,this.invoke("getServerData",{url:"https://www.dxy.cn/webservices/comment/list/mark",method:"get",params:{limit:t,pge:r,identify:"dxy_article_".concat(i)}}).then(function(d){var s,u,c;if((s=d.data)===null||s===void 0?void 0:s.success){var m=(u=d.data)===null||u===void 0?void 0:u.message,f=m.list,v=m.total,A=m.pge;return{list:f,total:v,pageSize:A}}return Promise.reject((c=d.data)===null||c===void 0?void 0:c.message)})]})})},e.prototype.queryQADetail=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://newdrugs.dxy.cn/app/drug-ask-question/list",method:"get",params:n}).then(function(t){var r;return(r=t==null?void 0:t.data)===null||r===void 0?void 0:r.data})]})})},e.prototype.queryQAConfig=function(){return C(this,void 0,void 0,function(){return X(this,function(n){return[2,this.getServerData({url:"https://newdrugs.dxy.cn/app/drug-ask-question/config",method:"get"}).then(function(i){var t;return(t=i==null?void 0:i.data)===null||t===void 0?void 0:t.data})]})})},e.prototype.receiveDingdang=function(n){var i=n.type,t=n.id;return C(this,void 0,void 0,function(){return X(this,function(r){return[2,this.invoke("getServerData",{url:"https://newdrugs.dxy.cn/app/user/quickAnswer/share",method:"get",params:{id:t,type:i}}).then(function(a){var d;return(d=a==null?void 0:a.data)===null||d===void 0?void 0:d.data})]})})},e.prototype.selectQAAnswer=function(n){var i=n.answer,t=n.id;return C(this,void 0,void 0,function(){return X(this,function(r){return[2,this.invoke("getServerData",{url:"https://newdrugs.dxy.cn/app/drug-ask-question/answer",method:"post",params:{id:t,answer:i}}).then(function(a){return a==null?void 0:a.data})]})})},e.prototype.queryQAAnswers=function(n){var i=n.id;return C(this,void 0,void 0,function(){return X(this,function(t){return[2,this.invoke("getServerData",{url:"https://newdrugs.dxy.cn/app/drug-ask-question/correct-answerer/list",method:"get",params:{id:i}}).then(function(r){var a;return(a=r==null?void 0:r.data)===null||a===void 0?void 0:a.data})]})})},e.prototype.pageSelected=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("pageSelected",n)]})})},e.prototype.expandContent=function(){return this.invoke("expandContent")},e.prototype.getMobileOrigin=function(){return C(this,void 0,void 0,function(){var n;return X(this,function(i){switch(i.label){case 0:return[4,this.getNetworkEnv()];case 1:switch(n=i.sent().env,n){case Cn.UAT:return[2,"https://newdrugs-uat.dxy.cn"];case Cn.TEST:return[2,"https://newdrugs-test.dxy.net"];case Cn.DEV:return[2,"https://newdrugs-dev.dxy.net"];default:return[2,"https://newdrugs.dxy.cn"]}}})})},e.prototype.redirectSpecificAdvisor=function(n){return this.invoke("redirectSpecificAdvisor",n)},e.prototype.redirectMiniProgram=function(n){return this.invoke("redirectMiniProgram",n)},e.prototype.saveComments=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("getServerData",{url:"https://newdrugs.dxy.cn/app/user/underline/record/save",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.redirectSubscription=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("redirectSubscription",n)]})})},e.prototype.subscribeDisease=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("subscribeDisease",n)]})})},e.prototype.getDiseaseSubscription=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("getDiseaseSubscription",n)]})})},e.prototype.queryDrugSupervise=function(){return C(this,void 0,void 0,function(){return X(this,function(n){return[2,this.invoke("getServerData",{url:"https://newdrugs.dxy.cn/app/drug/supervision-level/info",method:"GET"}).then(function(i){return(i==null?void 0:i.data)||{}})]})})},e.prototype.toggleTranslationGuide=function(){return this.invoke("toggleTranslationGuide")},e.prototype.queryAntibacterialSpectrum=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.invoke("getServerData",{url:"https://newdrugs.dxy.cn/app/antimicrobial-spectrum/detail",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.createChatStream=function(n,i){var t=this,r="https://ai.dxy.net/api/cm/client/chat/stream".concat((i==null?void 0:i.isResume)?"-resume":(i==null?void 0:i.isFollowUp)?"/follow-up":n.prescriptionParam?"/prescription-review":"");try{var a="";return this.getStreamData("getStreamData",{url:r,method:"POST",params:n},function(d){var s;if(typeof d=="string"){var u=a+d;a="",console.log("receive data",u),u.startsWith("data:")&&(u=u.slice(5)),u.endsWith(`

`)&&(u=u.slice(0,u.length-2)),u.split(`

data:`).forEach(function(c){var m;try{(m=i==null?void 0:i.onReceive)===null||m===void 0||m.call(i,JSON.parse(c))}catch(f){a+=c,console.error(f),$t("getStreamData",h(h({text:c,chunk:a,username:i.usename},n),{errMsg:JSON.stringify(f)}))}})}else switch(t.daTrackEvent({pageName:"app_p_home_page",eventId:"app_e_sse_request_abort",objectId:n.chatId,objectName:n.message,userInfo:{reason:"6",extra:JSON.stringify(d)}}),d.code){case 402:(s=i.onReceive)===null||s===void 0||s.call(i,{success:!1,message:"\u7F51\u7EDC\u8FDE\u63A5\u5DF2\u4E2D\u65AD",finish:!0,errorCode:d.code});break}})}catch(d){return console.error(222,d),0}},e.prototype.cmShareConfig=function(n){return this.invoke("cmShareConfig",n)},e.prototype.cmCollectConfig=function(n){return this.invoke("cmCollectConfig",n)},e.prototype.cancelChatStream=function(n){return this.close(n)},e.prototype.getChatStreamDetail=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/last-relation-id",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.getChatDetail=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/detail",method:"GET",params:n}).then(function(t){return ii(t==null?void 0:t.data)})]})})},e.prototype.getChatFollowUpInfo=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/follow-up-info",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.getSharedChatDetail=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/share/open",method:"GET",params:n}).then(function(t){return ri(t==null?void 0:t.data)})]})})},e.prototype.getPrescription=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/get-prescription-text",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.recognizePrescription=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/prescription-recognize",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.getFollowUpInfo=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/follow-up-info",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.querySuggest=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/suggest-query/v2",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.getThinkingImages=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm-biz/client/thinking-images/list",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.getReferenceList=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/reference",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.queryreferenceCitation=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/reference/citation/v2",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.translateCitionReference=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/reference/citation/translate",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.getScoreContent=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/get-score-detail",method:"GET",params:n}).then(function(t){var r,a,d,s,u,c;return h(h({},(t==null?void 0:t.data)||{}),{results:h(h({},((r=t==null?void 0:t.data)===null||r===void 0?void 0:r.results)||{}),{item:h(h({},((d=(a=t==null?void 0:t.data)===null||a===void 0?void 0:a.results)===null||d===void 0?void 0:d.item)||{}),{content:me((c=(u=(s=t==null?void 0:t.data)===null||s===void 0?void 0:s.results)===null||u===void 0?void 0:u.item)===null||c===void 0?void 0:c.content)})})})})]})})},e.prototype.setScoreContent=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/score",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.createShareId=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/share/create",method:"POST",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.openShareModal=function(n){return this.invoke("openShareModal",n)},e.prototype.openSharePoster=function(n){return this.invoke("openSharePoster",n)},e.prototype.redirectCMMember=function(){return this.invoke("redirectCMMember",null)},e.prototype.prescriptionReview=function(){return this.invoke("prescriptionReview",null)},e.prototype.qaReview=function(){return this.invoke("qaReview",null)},e.prototype.resetPageInit=function(n){return this.invoke("resetPageInit",n)},e.prototype.getConfigs=function(){return C(this,void 0,void 0,function(){return X(this,function(n){return[2,this.getServerData({url:"https://newdrugs.dxy.cn/app/pc/configs",method:"GET"}).then(function(i){return(i==null?void 0:i.data)||{}}).catch(function(){return{}})]})})},e.prototype.getClinMasterUserInfo=function(){return C(this,void 0,void 0,function(){return X(this,function(n){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/user/auth-info",method:"GET"}).then(function(i){return(i==null?void 0:i.data)||{}})]})})},e.prototype.toggleChatFav=function(n){return C(this,void 0,void 0,function(){var i;return X(this,function(t){return i=n.fav,[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/favorites/".concat(i?"add":"remove"),method:"POST",params:{chatId:n.chatId}}).then(function(r){return(r==null?void 0:r.data)||{}})]})})},e.prototype.cmDetailConfig=function(n){return this.invoke("cmDetailConfig",n)},e.prototype.openService=function(n){return this.invoke("openService",n)},e.prototype.getPrescriptionFile=function(n){return C(this,void 0,void 0,function(){return X(this,function(i){return[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/get-prescription-img",method:"GET",params:n}).then(function(t){return(t==null?void 0:t.data)||{}})]})})},e.prototype.fileReupload=function(){return C(this,void 0,void 0,function(){return X(this,function(n){return[2,this.invoke("fileReupload",null)]})})},e.prototype.checkPrescriptionDrug=function(n){return C(this,void 0,void 0,function(){var i,t,r;return X(this,function(a){return i=n.isPrescription,t=n.isGet,r=Ge(n,["isPrescription","isGet"]),i?t?[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/get-prescription-drug-risk",method:"GET",params:r}).then(function(d){return Vn(d==null?void 0:d.data)})]:[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/prescription-drug-risk",method:"POST",params:r}).then(function(d){return Vn(d==null?void 0:d.data)})]:t?[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/get-drug-risk",method:"GET",params:r}).then(function(d){return Vn(d==null?void 0:d.data)})]:[2,this.getServerData({url:"https://ai.dxy.cn/api/cm/client/chat/drug-risk",method:"POST",params:r}).then(function(d){return Vn(d==null?void 0:d.data)})]})})},e}(ni),ai=`.index-module_simple-module__sTQ0T .ck-content p,.index-module_simple-module__sTQ0T .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__sTQ0T [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__sTQ0T [data-menu-index='1'] h1,.index-module_simple-module__sTQ0T [data-menu-index='1'] h2,.index-module_simple-module__sTQ0T [data-menu-index='1'] h3,.index-module_simple-module__sTQ0T [data-menu-index='1'] h4,.index-module_simple-module__sTQ0T [data-menu-index='1'] h5,.index-module_simple-module__sTQ0T [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__sTQ0T [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_literature__-QboR {
  margin: 0 20px;
  overflow: hidden;
  position: relative;
}
.index-module_literature__-QboR .vip-tag {
  position: relative;
  margin-left: 8px;
  background: url('data:image/png;base64,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') center / 1.375rem 0.875rem no-repeat;
}
.index-module_literature__-QboR .vip-tag::after {
  display: inline-block;
  width: 1.6875rem;
  content: '';
}
.index-module_literature__-QboR .vip-plus-tag {
  position: relative;
  margin-left: 8px;
  background: url('data:image/png;base64,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') center / 3.875rem 1rem no-repeat;
}
.index-module_literature__-QboR .vip-plus-tag::after {
  display: inline-block;
  width: 3.9375rem;
  content: '';
}
.index-module_literature__-QboR .more-title h1,.index-module_literature__-QboR .more-title h2,.index-module_literature__-QboR .more-title h3,.index-module_literature__-QboR .more-title h4,.index-module_literature__-QboR .more-title h5,.index-module_literature__-QboR .more-title h6 {
  position: relative;
  margin: 0;
  color: #333;
  font-weight: 500;
}
.index-module_literature__-QboR .more-title h1::before,.index-module_literature__-QboR .more-title h2::before,.index-module_literature__-QboR .more-title h3::before,.index-module_literature__-QboR .more-title h4::before,.index-module_literature__-QboR .more-title h5::before,.index-module_literature__-QboR .more-title h6::before {
  display: inline-block;
  margin-right: 4px;
  vertical-align: text-bottom;
  content: '.';
}
.index-module_literature__-QboR .more-title h1 *,.index-module_literature__-QboR .more-title h2 *,.index-module_literature__-QboR .more-title h3 *,.index-module_literature__-QboR .more-title h4 *,.index-module_literature__-QboR .more-title h5 *,.index-module_literature__-QboR .more-title h6 * {
  display: inline;
}
.index-module_literature__-QboR .more-title p,
.index-module_literature__-QboR .more-title div {
  margin-top: 0;
}
.index-module_literature__-QboR .more-link {
  font-weight: 400;
  position: relative;
  box-sizing: content-box;
  display: -webkit-box;
  padding-right: 12px;
  margin: 12px 0;
  overflow: hidden;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #333;
  text-decoration: none;
  text-overflow: ellipsis;
  vertical-align: middle;
  background-color: #f5f6f9;
  border-color: transparent;
  border-style: solid;
  border-width: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.index-module_literature__-QboR .more-link::before {
  position: relative;
  z-index: 99;
  box-sizing: border-box;
  width: 2.875rem;
  height: 0.875rem;
  padding: 1px 3px;
  margin-right: 11px;
  font-size: 0.625rem;
  line-height: 0.875rem;
  color: #7753ff;
  vertical-align: middle;
  background-color: #fff;
  border-radius: 0.25rem;
  font-weight: 500;
}
.index-module_literature__-QboR .more-link::after {
  position: absolute;
  top: 50%;
  right: 0;
  display: block;
  float: right;
  width: 0.375rem;
  height: 0.625rem;
  margin-right: 0;
  content: '';
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAHJb+yRAAAABGdBTUEAALGPC/xhBQAAAl9JREFUOBGFlM2LE0EQxacnDggeArl6MYecwyb5DzwJCgui4Ap+IagogpKDCCu66kEW8QN2PQQXVlaFPejBi4cFLx7z8Yd4FhTdxN/r6e7tmQyxIenq915VV9XUTJLEazgcztIYyO3ZbGbmUcSDhL9vlkJTk/u8DiQQMkaj0SerGo/HF2J5Op1Ot4PUMwI8GLIA+IPgkBVxuOoVumo5HERz+GFl7s8AnMHe1bnb7abGmELW8SWB6PV6AQ+Gi5hQ0T71285JONdCyDuR+GWIQC4rEO8d+QHv87INvTlOO/bswZivJHrCiQ42vAcHp6KVQv4FUmfeFKn8pCR3HHEd0auyKCWZS4DPHXGbMtdjka+3n6bpPRGU2Uf01ItCmQKo6AoVvZVNyx9S0aOCQAR5LLN9ls26XyUoPJNCq7l7mjvmT1Z2ELiHZCNyd80/9ppU3Kt5sjZkBrkvXCvF8xe7HbZ6vX4YUp0NS1csudORVqv1OzDOsHdS/zkatKNBIcKg0+lc8zmUHcpnQwpytLMRkwTYIN9bMVZl2wwIoEAbCG6URQR6QaC7Zdyfqx7EGuSqF0T7MwbHzkOEJXMBPElGSv+1svOY2x8T6IHHyqTHw64GM2DvAPLvgmOYzlWa/eS/AaRnEPpshTkXTn/WFwbAUU3dlDheOG7S2JvCKgPgeBHRluYidsTexvEyXJj4QgAc9R37yM/OrXfGYZd6V9jDDHvONoaOn+Q2fYQzT2jH4Qv4aW7Vy1C5zGQyOUaXvyM86hU47jUajVPNZlMvysIVSiCLLkHWsiw72263fy70ish/1kUOgTMTIBQAAAAASUVORK5CYII=') right center / contain no-repeat;
  transform: translateY(-50%);
}
.index-module_literature__-QboR .icon-dui_roundinfo {
  margin-left: 8px;
  font-size: 1.25rem;
  color: #999;
  font-weight: 400;
}
.index-module_literature__-QboR .index-module_date__XSjxr {
  position: absolute;
  top: 0;
  right: 0;
  margin-top: inherit;
  font-size: 0.625rem;
  font-weight: 400;
  line-height: 1.875rem;
  color: #333;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC {
  padding: 12px;
  background-color: #f5f6f9;
  border-radius: 0.75rem;
  transition: height 0.5s ease;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC > :first-child {
  margin-top: 0;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC > :last-child {
  margin-bottom: 0;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-folder__sIqCU {
  display: none;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-folder__sIqCU > :first-child {
  margin-top: 0;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-operation__sZvtX {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7753ff;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-operation__sZvtX span {
  margin-right: 4px;
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 400;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-operation__sZvtX i {
  font-size: 0.75rem;
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-open__SPyHn i {
  transform: rotate(-90deg);
}
.index-module_literature__-QboR .index-module_literature-list__7LWxC .index-module_literature-list-close__mzV7R i {
  transform: rotate(90deg);
}
.index-module_literature__-QboR div[id^='literature-anchor-'] {
  margin-bottom: 0;
}
.index-module_literature__-QboR div.new-line {
  margin: 0;
}
.index-module_literature-list-item__L2PoZ {
  font-weight: 400;
  margin: 12px 0;
  font-size: 0.875rem;
  line-height: 1.1875rem;
  color: #666;
}
.index-module_literature-list-item__L2PoZ.index-module_literature-list-link__zzrZr {
  color: #371A97;
}
.index-module_literature-list-item__L2PoZ .index-module_rich-literature__MXPez {
  display: inline;
}
.index-module_literature-list-item__L2PoZ .index-module_rich-literature__MXPez p,
.index-module_literature-list-item__L2PoZ .index-module_rich-literature__MXPez div {
  font-size: 0.875rem;
  line-height: 1.1875rem;
}
.index-module_literature-list-item__L2PoZ .index-module_rich-literature__MXPez * {
  display: inline !important;
}
.index-module_literature-list-item__L2PoZ .index-module_rich-literature__MXPez a {
  font-weight: normal;
  text-decoration: none;
}
.index-module_literature-list-item__L2PoZ .index-module_rich-literature__MXPez a::after {
  content: none;
}
.index-module_literature-link__AYxum.dxy-comment-disabled {
  -webkit-user-select: text;
     -moz-user-select: text;
          user-select: text;
}
.index-module_popup__kZhy5 .index-module_body__DSjH- {
  padding-bottom: 0;
  padding-bottom: calc(constant(safe-area-inset-bottom));
  padding-bottom: calc(env(safe-area-inset-bottom));
  border-top-left-radius: 1.5rem;
  border-top-right-radius: 1.5rem;
  box-shadow: 0 -0.25rem 0.625rem 0 rgba(0, 0, 0, 0.1);
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal__IkdiD {
  padding: 0 16px;
  background-color: #fff;
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal-close__Hw3VX {
  position: absolute;
  top: 50%;
  right: 0;
  font-size: 1.5rem;
  transform: translateY(-50%);
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal-title__9WA58 {
  position: relative;
  padding: 0;
  margin: 18px 0;
  font-size: 1.0625rem;
  font-weight: bold;
  color: #333;
  text-align: center;
  font-weight: 500;
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal-content__3ph-G {
  min-height: 16.25rem;
  max-height: 21.4375rem;
  overflow-y: scroll;
  pointer-events: auto;
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal-content__3ph-G::-webkit-scrollbar {
  display: none;
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal-content__3ph-G .index-module_literature-list-item__L2PoZ {
  font-weight: 400;
  margin-top: 0;
  font-size: 0.8125rem;
  line-height: 1.25rem;
}
.index-module_popup__kZhy5 .index-module_body__DSjH- .index-module_literature-modal-content__3ph-G .index-module_literature-list-item__L2PoZ * {
  font-size: 0.8125rem;
  line-height: 1.25rem;
}
.index-module_popup__kZhy5.index-module_horizontal__GnYLy .index-module_body__DSjH- {
  box-sizing: border-box;
  width: calc(100vh - 2px);
  width: calc(100vh - 2px - constant(safe-area-inset-bottom));
  width: calc(100vh - 2px - env(safe-area-inset-bottom));
  min-height: 16.25rem;
  max-height: 21.4375rem;
  padding-bottom: 0;
  transform: translateY(1px) translateY(-100vh) rotate(90deg) !important;
  transform-origin: left bottom;
}
.index-module_popup__kZhy5.index-module_horizontal__GnYLy .index-module_body__DSjH- .index-module_literature-modal__IkdiD {
  display: flex;
  flex-direction: column;
  min-height: 16.25rem;
  max-height: 21.4375rem;
  border-top-left-radius: inherit;
  border-top-right-radius: inherit;
}
.index-module_popup__kZhy5.index-module_horizontal__GnYLy .index-module_body__DSjH- .index-module_literature-modal__IkdiD .index-module_literature-modal-content__3ph-G {
  flex: 1;
  min-height: unset;
  max-height: unset;
}
`,se={"simple-module":"index-module_simple-module__sTQ0T",literature:"index-module_literature__-QboR",date:"index-module_date__XSjxr","literature-list":"index-module_literature-list__7LWxC","literature-list-folder":"index-module_literature-list-folder__sIqCU","literature-list-operation":"index-module_literature-list-operation__sZvtX","literature-list-open":"index-module_literature-list-open__SPyHn","literature-list-close":"index-module_literature-list-close__mzV7R","literature-list-item":"index-module_literature-list-item__L2PoZ","literature-list-link":"index-module_literature-list-link__zzrZr","rich-literature":"index-module_rich-literature__MXPez","literature-link":"index-module_literature-link__AYxum",popup:"index-module_popup__kZhy5",body:"index-module_body__DSjH-","literature-modal":"index-module_literature-modal__IkdiD","literature-modal-close":"index-module_literature-modal-close__Hw3VX","literature-modal-title":"index-module_literature-modal-title__9WA58","literature-modal-content":"index-module_literature-modal-content__3ph-G",horizontal:"index-module_horizontal__GnYLy"};ve(ai);var di=function(e){var n=e.content,i=e.lastLiteratureDate,t=e.maxShow,r=t===void 0?0:t,a=e.onLiteratureItemClick,d=e.onLiteratureClick,s=e.richMode,u=s===void 0?!0:s,c=Object(p.useState)(!r),m=c[0],f=c[1],v=Object(p.useState)(!1),A=v[0],g=v[1],y=Object(p.useState)(!1),x=y[0],j=y[1],R=Object(p.useState)(),Z=R[0],W=R[1],K=Object(p.useMemo)(function(){if(Z){var b=Gt(Z);return n==null?void 0:n.filter(function(M){return b==null?void 0:b.includes(M.position)})}return[]},[n,Z]),D=Object(p.useMemo)(function(){return vn()},[]),ee=Object(p.useCallback)(function(b){var M=b.target.innerText.replace(/\[([^[\]]+)\]/g,"$1");if(M){W(M),d&&d();var V=T()(b.target).parents(".fullscreen");V.length?(j(!0),g(V.hasClass("horizontal"))):_.showGoTopView({show:!1}),b.stopPropagation(),b.preventDefault()}},[d,n]),Y=function(){x||_.showGoTopView({show:!0}),W(""),g(!1),j(!1)},H=Object(p.useCallback)(function(){f(!m),T()(".".concat(se["literature-list-folder"])).slideToggle()},[m]),k=function(M){var V=M.title,F=M.position,J=M.url;return l.a.createElement("p",{id:"literature-anchor-".concat(F),className:I()(se["literature-list-item"],J?se["literature-list-link"]:null)},F?l.a.createElement("span",{className:se.position},F,". "):null,J||!u?l.a.createElement("span",{onClick:function(){J&&(a&&a(),_.redirectCommon({type:re.WEB,url:J}))}},V):l.a.createElement(Qe.b,{dangerouslySetInnerHTML:{__html:V},className:se["rich-literature"],preTransform:function(G,oe){var pe,ye,ze;if(Object(Qe.c)(G)){if(((pe=G.attribs)===null||pe===void 0?void 0:pe.class)&&delete G.attribs.class,!G.parent&&!F&&oe)return null;if(G.type==="tag"&&G.name==="a"&&((ye=G.attribs)===null||ye===void 0?void 0:ye.href)&&/^https?:\/\//.test(G.attribs.href)){if(!D){var be=G.attribs.href;G.attribs.class=I()((ze=G.attribs)===null||ze===void 0?void 0:ze.class,"J-redirect"),G.attribs["data-type"]=re.WEB,G.attribs["data-url"]=be}delete G.attribs.href}}},reserveStyle:!0}))};return Object(p.useEffect)(function(){return T()("body").on("click",".".concat(se["literature-link"]),ee),function(){T()("body").off("click",".".concat(se["literature-link"]),ee)}},[ee]),Object(p.useLayoutEffect)(function(){if(n)return T()(".literature-sup").addClass(se["literature-link"]),T()(".literature-sup").addClass("dxy-comment-disabled"),function(){T()(".literature-sup").removeClass(se["literature-link"]),T()(".literature-sup").removeClass("dxy-comment-disabled")}},[n]),n?l.a.createElement("section",{className:I()(se.literature,"dxy-comment-disabled")},l.a.createElement("div",{"data-menu-index":"1"},l.a.createElement("h2",null,"\u53C2\u8003\u6587\u732E"),i?l.a.createElement("span",{className:se.date},"\u6587\u732E\u8BC4\u5BA1\u65E5\u671F\uFF1A",i):null,l.a.createElement("div",{"data-menu-index":"4"},l.a.createElement("div",{className:se["literature-list"]},(r?n.slice(0,r):n).map(function(b){return l.a.createElement(k,h({key:b.position},b))}),r&&n.length>r?l.a.createElement(l.a.Fragment,null,l.a.createElement("div",{className:se["literature-list-folder"]},n.slice(r).map(function(b){return l.a.createElement(k,h({key:b.position},b))})),l.a.createElement("div",{className:I()(se["literature-list-operation"],m?se["literature-list-open"]:se["literature-list-close"]),onClick:H},l.a.createElement("span",null,m?"\u6536\u8D77":"\u5C55\u5F00"),l.a.createElement("i",{className:"iconfont icon-arrow_right"}))):null))),(K==null?void 0:K.length)?l.a.createElement(Ae.b,{visible:!0,onMaskClick:function(){Y()},className:I()(se.popup,x&&A&&se.horizontal,"dxy-comment-disabled"),bodyClassName:se.body,maskStyle:{background:"transport",opacity:"0"},style:{"--z-index":"9999"}},l.a.createElement("div",{className:se["literature-modal"],onTouchStart:function(M){return M.stopPropagation()},onTouchMove:function(M){return M.stopPropagation()}},l.a.createElement("p",{className:se["literature-modal-title"]},"\u53C2\u8003\u6587\u732E [",Z,"]",l.a.createElement("i",{className:I()("iconfont","icon-dui_close",se["literature-modal-close"]),onClick:Y})),l.a.createElement("div",{className:se["literature-modal-content"]},K.map(function(b){var M=b.url,V=b.position,F=b.title;return l.a.createElement(k,{key:V,position:V,url:M,title:F})})))):null):null},Xt=Object(p.createContext)({install:function(){},setMenus:function(){},detail:{vipLevel:0,showFeatureGuideCorrect:!1,fontScale:1},menus:null}),lt,Pt=function(){return!lt&&typeof document!="undefined"&&(lt=document.createElement("div")),lt},ut=function(e){var n,i=e.clone();i.find(".literature-sup,.dxy-ordered-node").remove();var t=i.attr("data-header-text");return t||((n=i.text())===null||n===void 0?void 0:n.trim())},Gn=function(e){var n=e.attr("data-header-text");if(n)return n;var i=e.clone();i.find(".literature-sup,.dxy-ordered-node").remove();var t=i.contents().map(function(r,a){switch(a.nodeType){case Node.ELEMENT_NODE:if(a.nodeName==="SUP"||a.nodeName==="SUB"){var d=a.nodeName.toLowerCase();return"<".concat(d,">").concat(Gn(T()(a)),"</").concat(d,">")}return"".concat(Gn(T()(a)));case Node.TEXT_NODE:return a.textContent;default:return""}}).get().join("")||"";return t},zt=function(e){return!!(e&&e instanceof HTMLElement)},li=function(e){var n;return ut((n=T()(e))===null||n===void 0?void 0:n.parents("[data-menu-anchor]").first().find('> :header:not([data-disabled="true"])'))},ui=function(){var e=Pt();e&&(Object(Ze.render)(l.a.createElement(Ae.a,{visible:!0,destroyOnClose:!0}),e),document.body.appendChild(e))},si=function(){var e=Pt();(e==null?void 0:e.parentElement)===document.body&&(Object(Ze.unmountComponentAtNode)(e),document.body.removeChild(e))},st=function(e){for(var n=e;n;){if(n.hasAttribute("data-over-mask"))return n;n=n.parentElement}return null},ci=function(e){for(var n=e,i=null;n;){if(n.nodeName==="TABLE")i=n;else if(n.nodeName==="FIGURE"&&n.classList.contains("table"))return n;n=n.parentElement}return i},mi=function(e){for(var n=e;n;){if(n.classList.contains("simplebar-content-wrapper"))return n;n=n.parentElement}return null},vi=function(e){for(var n=e;n;){if(n.nodeName==="TD")return n;n=n.parentElement}return null},fi=function(){if(typeof document!="undefined")return{minWidth:document.body.clientWidth>800?768:document.body.clientWidth-40}},Ue=function(e){var n=e.data,i=n.event_id,t=n.object_id,r=n.object_name,a=n.ext,d=Ge(n,["event_id","object_id","object_name","ext"]);return _.daTrackEvent(h(h({},d),{eventId:i,objectId:t,objectName:r,userInfo:a}))};function pi(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}var Ai=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_simple-module__V5fO4 .ck-content p,.index-module_simple-module__V5fO4 .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__V5fO4 [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__V5fO4 [data-menu-index='1'] h1,.index-module_simple-module__V5fO4 [data-menu-index='1'] h2,.index-module_simple-module__V5fO4 [data-menu-index='1'] h3,.index-module_simple-module__V5fO4 [data-menu-index='1'] h4,.index-module_simple-module__V5fO4 [data-menu-index='1'] h5,.index-module_simple-module__V5fO4 [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__V5fO4 [data-menu-index='4'] {
  margin-top: 8px;
}
.index-module_space__MeaLh {
  height: 0.5rem;
}
.index-module_tabs-tabbar__767K- {
  position: sticky;
  top: 0;
  z-index: 100;
  width: 100%;
  background-color: #fff;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC {
  position: relative;
  display: flex;
  overflow-x: scroll;
  overflow-y: hidden;
  overflow: scroll hidden;
  text-align: center;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC::-webkit-scrollbar {
  display: none;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8 {
  position: relative;
  display: inline-block;
  flex: none;
  height: 44PX;
  padding: 0 14px;
  font-size: 0.875rem;
  line-height: 44PX;
  color: #666666;
  white-space: nowrap;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8:first-child {
  padding-left: 20px;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8:first-child.index-module_tabs-tabbar-item-active__q1ARJ::after {
  left: 1.25rem;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8:last-child {
  padding-right: 20px;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8:last-child.index-module_tabs-tabbar-item-active__q1ARJ::after {
  right: 1.25rem;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8.index-module_tabs-tabbar-item-flexible__pvhcR {
  box-sizing: border-box;
  flex: none;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item-active__q1ARJ {
  color: #7753ff;
  font-weight: 500;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item-img__493xz {
  box-sizing: content-box;
  height: 100%;
  -o-object-fit: cover;
     object-fit: cover;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-menu__sjGaY {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  display: block;
  height: 44PX;
  padding: 0 22px;
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAABJCAYAAACXWsCYAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAE4SURBVHgB7doxToRQFIXhg2Sm1h3MEsapXIbu4FmQ0BlLdzG2QDKUlrgDSiucJbAEa0LAyxI0N5lH5v8SWvJyICT3cCUAAAAAAAAAAAAgkbMQwn673T4qDueiKBo5cg3MwtptNpvvJEluFY9XC+0oJzdyZG9WiCysxYscuQY2TdOPIjPPcy9HroFVVXW0A74rEnaWNk3TZwEAAADXxr2tyLLsZPNkUBzOwzA81XXdy4nraGRhhYjCWuytPTnJkWtgFtZO8XFtT1wDs2G3sSuqxsIe4qccuX/D8jzfWc0TFAE7R2sNSisAAACs3mpWBZZ/nuM4Np6D9H+sbVWgt/bh3kK72Pi1tlWB5YFcdNFldasC3r/+/yqVo67rvg6Hw529ZQ9ytrQgdt+3siw/BAAAAAAAAADA9fkFZbRlAOe11/gAAAAASUVORK5CYII=') 0 center / 1.5rem 1.5rem no-repeat, #fff;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-menu__sjGaY + .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8:last-child {
  padding-right: 64px;
}
.index-module_tabs-tabbar__767K- .index-module_tabs-tabbar-menu__sjGaY + .index-module_tabs-tabbar-container__3tEAC .index-module_tabs-tabbar-item__kKSq8:last-child.index-module_tabs-tabbar-item-active__q1ARJ::after {
  right: 4rem;
}
.index-module_tabs-content__mq9jk {
  overflow: hidden;
}
.index-module_tabs-content__mq9jk > :last-child {
  margin-bottom: 32px;
}
`,Le={"simple-module":"index-module_simple-module__V5fO4",space:"index-module_space__MeaLh","tabs-tabbar":"index-module_tabs-tabbar__767K-","tabs-tabbar-container":"index-module_tabs-tabbar-container__3tEAC","tabs-tabbar-item":"index-module_tabs-tabbar-item__kKSq8","tabs-tabbar-item-active":"index-module_tabs-tabbar-item-active__q1ARJ","tabs-tabbar-item-flexible":"index-module_tabs-tabbar-item-flexible__pvhcR","tabs-tabbar-item-img":"index-module_tabs-tabbar-item-img__493xz","tabs-tabbar-menu":"index-module_tabs-tabbar-menu__sjGaY","tabs-content":"index-module_tabs-content__mq9jk"};ve(Ai);var Bn;typeof window!="undefined"&&(window.goto=function(o){Bn=o});var ct=typeof document!="undefined"&&"scrollBehavior"in document.documentElement.style?De.a:_n.a,hi=function(e,n){var i=Object(p.useState)(null),t=i[0],r=i[1],a=Object(p.useState)([]),d=a[0],s=a[1],u=Object(p.useState)([]),c=u[0],m=u[1],f=Object(p.useRef)(new Map),v=Object(p.useRef)(),A=Object(p.useRef)(Object(Je.a)()),g=Object(p.useRef)(!0),y=Object(p.useContext)(Xt).setMenus,x=e.position,j=x===void 0?"sticky":x,R=e.offsetY,Z=R===void 0?0:R,W=e.diffY,K=W===void 0?0:W,D=e.animation,ee=D===void 0?200:D,Y=e.delay,H=Y===void 0?300:Y,k=e.visible,b=k===void 0?!0:k,M=e.flexible,V=M===void 0?!1:M,F=e.menus,J=e.transformMenu,Q=e.showMenuIcon,G=e.tabItemClass,oe=e.anchorPoint,pe=e.onReady,ye=e.moduleType,ze=e.id,be=e.isTrackDuration,kn=j==="sticky",Oe=Object(p.useCallback)(function(){var N=T()("[data-menu-index]:not([data-plain])");N.each(function(P,E){var L=T()(E),S=L.parents("[data-menu-anchor]").attr("data-menu-anchor")||"",z=L.find("> [data-section-index]:header"),O=z.length?z:L.find("> :header");O.length>1||O.length&&L.attr("data-menu-anchor","".concat(S?"".concat(S,"&__&"):"").concat(ut(O)))})},[]),de=Object(p.useCallback)(function(){var N=T()("[data-anchor-index]:not([data-plain])");N.each(function(P,E){var L=P>0?N==null?void 0:N[P-1]:null,S=T()(E).parents("[data-menu-anchor]").attr("data-menu-anchor");if(L&&S){var z=T()(L).attr("data-menu-anchor"),O=(z==null?void 0:z.indexOf("".concat(S,"&__&")))===0;if(O){var B=T()(L).attr("data-anchor-index"),U=T()(E).attr("data-anchor-index");if(+U>+B)S=z;else if(+U==+B){var q=z.lastIndexOf("&__&");S=z.slice(0,q)}else for(var $=P-1;$--;){var ne=T()(N[$]),te=ne.attr("data-anchor-index"),Ce=ne.attr("data-menu-anchor");if((Ce==null?void 0:Ce.indexOf(S))===0){if(+te<+U){S=Ce;break}}else break}}}T()(E).attr("data-menu-anchor","".concat(S?"".concat(S,"&__&"):"").concat(ut(T()(E))))})},[]),xe=Object(p.useCallback)(function(N){var P=N.cellId,E=N.start,L=N.now;!be||L-E>1e3&&pi({data:{pageName:"app_p_detail",event_id:"app_e_expose_title",logType:"app_e",ext:{uid:A.current,id:"".concat(ze),type:"".concat(ye),duration:"".concat(Math.ceil((L-E)/1e3)),field_name:P}}})},[ze,ye,be]),le=Object(p.useCallback)(function(N){if(N){var P=d.findIndex(function(z){return N.indexOf(z.key)===0});P>-1?r(P):r(null);var E=fn(c,N).cell,L=E===void 0?{}:E,S=L.cellId;_.redirectOutline(S)}else r(null),_.redirectOutline()},[d,c]),_e=Object(p.useCallback)(function(N,P,E){return C(void 0,void 0,void 0,function(){var L,S,z,O,B,U,q,O;return X(this,function($){return L=v.current,L?(g.current=!1,S=!1,z=[],ye===ae.CLINICAL?(O=st(N),B=ci(N),B&&(O&&z.push(L(O)),U=mi(N),U&&(q=vi(N),z.push(L(B,{boundary:O})),z.push(new Promise(function(ne){return ct(q||N,{block:"start",skipOverflowHiddenElements:!1,boundary:U,behavior:function(Ce){var we=0,Ke=U.querySelector("thead");Ke&&(we=Ke.getBoundingClientRect().height),Ce.forEach(function(Me){var ln=Me.el,nn=Me.top,pt=Me.left;T()(ln).animate({scrollLeft:pt,scrollTop:nn-we+1},0,ne)})}})})),S=!0))):ye===ae.EVIDENCE&&(O=st(N),O&&(z.push(L(O)),S=!0)),S||(z.push(L(N,E)),S=!0),le(P),[2,Promise.all(z).then(function(){g.current=!0})]):[2]})})},[le,H,ye]),Pe=function(P){dn(it,{key:P}),window.goto(P)},ue=Object(p.useCallback)(function(){var N=[],P=T()("[data-menu-anchor]"),E=function(S){if(S){var z=[{tag:2,className:"vip-plus-tag"},{tag:1,className:"vip-tag"}],O=z.find(function(B){var U=B.className;return S.hasClass(U)||S.find(".".concat(U)).length});return O?O.tag:0}return 0};return P.each(function(L,S){var z,O,B,U=T()(S),q=U.find("> :header").first(),$=U.attr("data-menu-anchor"),ne=U.attr("data-anchor-index"),te=((O=(z=$==null?void 0:$.split("&__&"))===null||z===void 0?void 0:z.length)!==null&&O!==void 0?O:1)-1;$&&(ne?N.push({data:{},title:Gn(U),level:te,tag:E(q),cellId:$,type:Number(ne),reachable:!0}):N.push({data:q.data(),title:Gn(q),level:te,tag:E(q),cellId:$,type:0,disabled:(B=q.data("disabled"))!==null&&B!==void 0?B:!1,reachable:!0}))}),Array.isArray(F)&&(F==null?void 0:F.length)&&(N=F==null?void 0:F.map(function(L){var S=N.some(function(z){return z.cellId===L.cellId});return h(h({},L),{reachable:S})})),y(N),typeof J=="function"?J(N):N},[J,F]);Object(p.useImperativeHandle)(n,function(){return{getMenu:function(P){return P&&c.length?c:ue()},getTab:function(){return document.querySelector(".".concat(Le["tabs-tabbar"]))}}},[c,ue]),Object(p.useLayoutEffect)(function(){Oe(),de();var N=ue();m(N),s(N.filter(function(P){return P.level===0}).map(function(P){return{title:P.title,key:P.title,data:P.data}}))},[ue,de,Oe]),Object(p.useLayoutEffect)(function(){if(c==null?void 0:c.length){var N=function(E){var L,S;return C(this,void 0,void 0,function(){var z,O,B,U,q,$,ne,te,Ce,B,U,q,we,Ke,$,ne,te,Ce,Me,ln;return X(this,function(nn){switch(nn.label){case 0:if(z=E,/^(image|table)\d+$/.test(E)){if(B=E.match(/^(image|table)(\d+)$/),U=B==null?void 0:B[1],q=B==null?void 0:B[2],O=(L=T()("figure.".concat(U,' figcaption[type="title"] [data-index="').concat(q,'"]'))[0])===null||L===void 0?void 0:L.closest("figure"),O){for($=Array.from(document.querySelectorAll("[data-menu-anchor]")),ne=0,te=$.length;ne<te;ne++)if(Ce=$[ne],Ce.compareDocumentPosition(O)&Node.DOCUMENT_POSITION_PRECEDING){ne===0?z="":z=$[ne-1].getAttribute("data-menu-anchor");break}}}else if(/^(f|t)\d+$/.test(E)){if(B=E.match(/^(f|t)(\d+)$/),U=(B==null?void 0:B[1])==="f"?"img":"table",q=Number(B==null?void 0:B[2]),we=T()(".ck-content ".concat(U).concat(U==="img"?":not([data-preview=false])":"",":eq(").concat(q,")")),Ke=(S=we.get(0))===null||S===void 0?void 0:S.closest("figure"),O=Ke||we.get(0),O){for($=Array.from(document.querySelectorAll("[data-menu-anchor]")),ne=0,te=$.length;ne<te;ne++)if(Ce=$[ne],Ce.compareDocumentPosition(O)&Node.DOCUMENT_POSITION_PRECEDING){ne===0?z="":z=$[ne-1].getAttribute("data-menu-anchor");break}}}else O=T()('[data-menu-anchor="'.concat(E.replace(/"/g,'\\"'),'"]'))[0],O||(Me=fn(c,E).cell,Me&&(O=T()('[data-menu-anchor="'.concat(Me.cellId.replace(/"/g,'\\"'),'"]'))[0],z=Me.cellId));return O&&!O.hasAttribute("data-disabled")?[4,_e(O,z)]:[3,2];case 1:return nn.sent(),[3,4];case 2:return ln=T()("#vipNode")[0],ln?[4,_e(ln,z,{skipOverflowHiddenElements:!0})]:[3,4];case 3:nn.sent(),nn.label=4;case 4:return dn(ei,z),[2]}})})};oe?setTimeout(function(){N(oe).then(function(){pe==null||pe(oe)})},300):pe==null||pe(),window.goto=N}Bn&&(window.goto(Bn),Bn="")},[_e,c,oe,pe,d]),Object(p.useLayoutEffect)(function(){var N=an(Ot,function(P){var E;(E=v.current)===null||E===void 0||E.call(v,P.el)});return N},[]),Object(p.useEffect)(function(){v.current=function(N,P){return C(void 0,void 0,void 0,function(){return X(this,function(E){return[2,new Promise(function(L){var S,z,O=Z+K+(b&&d.length>1?44:0);ct(N,{block:(P==null?void 0:P.block)||"start",skipOverflowHiddenElements:(S=P==null?void 0:P.skipOverflowHiddenElements)!==null&&S!==void 0?S:!1,boundary:(z=P==null?void 0:P.boundary)!==null&&z!==void 0?z:void 0,behavior:function(U){U.forEach(function(q){var $=q.el,ne=q.top,te=q.left;T()($).animate({scrollLeft:te,scrollTop:ne-O+1},ee,L)})}})})]})})}},[d,b,Z,K,ee]),Object(p.useEffect)(function(){if(b&&t!==null&&d.length>1){var N=T()(".".concat(Le["tabs-tabbar-item"],":eq(").concat(t,")"))[0];N&&ct(N,{behavior:"smooth",inline:"center",block:"start",boundary:N.parentElement})}},[t,d,b]),Object(p.useEffect)(function(){var N=Z+K+(b&&d.length>1?44:0),P=T()('[data-menu-anchor] > :header:not([data-disabled="true"])'),E=T()("[data-anchor-index][data-menu-anchor]"),L=new IntersectionObserver(function(z){var O;if(!!g.current){if(z.length===P.length+E.length){var B=z.findIndex(function(pt){return pt.boundingClientRect.top>0});if(B>=1){var U=z[B-1],q=T()(U.target).attr("data-menu-anchor")||T()(U.target).parent().attr("data-menu-anchor");if(q){var $=fn(c,q).cell;le($.cellId)}}return}for(var ne=T()(window).scrollTop()||0,te=0,Ce=z.length;te<Ce;te++){var U=z[te],q=T()(U.target).attr("data-menu-anchor")||T()(U.target).parent().attr("data-menu-anchor");if(q){var we=fn(c,q).cellIndex;if(we!==-1)if(U.isIntersecting){if(we>=1){for(;--we>=0;)if(!c[we].disabled&&c[we].reachable){var Me=c[we].cellId,ln=T()('[data-menu-anchor="'.concat(Me.replace(/"/g,'\\"'),'"]')),nn=(((O=ln.offset())===null||O===void 0?void 0:O.top)||0)-ne-N;if(nn<=0){le(Me);return}}}le();return}else{var Ke=U.boundingClientRect.top;if(Ke<=N){le(q);return}}}}}},{rootMargin:"-".concat(N,"px 0px 0px 0px"),threshold:[.99]});L.POLL_INTERVAL=100,P.each(function(z,O){L.observe(O)}),E.each(function(z,O){L.observe(O)});var S=null;return be&&(S=new IntersectionObserver(function(z){for(var O,B=0,U=z.length;B<U;B++){var q=z[B],$=(O=q.target)===null||O===void 0?void 0:O.getAttribute("data-menu-anchor"),ne=Date.now();if(q.isIntersecting)f.current.set($,ne);else{var te=f.current.get($);te&&(xe({start:te,now:ne,cellId:$}),f.current.delete($))}}},{rootMargin:"-".concat(N,"px 0px 0px 0px"),threshold:[.01]}),T()("[data-menu-index][data-menu-anchor]").each(function(z,O){S==null||S.observe(O)})),function(){L.disconnect(),S==null||S.disconnect()}},[d,c,le,b,Z,K,xe,be]),Object(p.useEffect)(function(){if(be){var N=function(){return C(void 0,void 0,void 0,function(){var z;return X(this,function(O){return z=Date.now(),f.current.forEach(function(B,U){xe({start:B,now:z,cellId:U})}),[2]})})},P=_.addEventListener("onShow",function(){return C(void 0,void 0,void 0,function(){var S;return X(this,function(z){return S=Date.now(),f.current.forEach(function(O,B){f.current.set(B,S)}),[2]})})}),E=_.addEventListener("onHide",N),L=_.addEventListener("onClose",N);return function(){E(),P(),L()}}return tt},[be,xe]);var fe=function(P){return P===void 0&&(P={}),l.a.createElement("div",h({className:I()(Le["tabs-tabbar"],"dxy-comment-disabled")},P),Q?l.a.createElement("div",{className:Le["tabs-tabbar-menu"],onClick:function(){return _.openMenuModal()}}):null,l.a.createElement("div",{className:Le["tabs-tabbar-container"]},d.map(function(E,L){var S,z,O,B,U,q=t===L,$=q&&((z=E.data)===null||z===void 0?void 0:z.imgActive)?(O=E.data)===null||O===void 0?void 0:O.imgActive:!q&&((B=E.data)===null||B===void 0?void 0:B.imgDeactive)?(U=E.data)===null||U===void 0?void 0:U.imgDeactive:"";return l.a.createElement("div",{key:L,className:I()(Le["tabs-tabbar-item"],(S={},S[Le["tabs-tabbar-item-active"]]=q,S[Le["tabs-tabbar-item-flexible"]]=V,S),G),style:{width:V&&d.length?"".concat(100/d.length,"%"):void 0},onClick:function(te){te.stopPropagation(),Pe(E.key)}},$?l.a.createElement("img",{"data-preview":!1,src:$,className:Le["tabs-tabbar-item-img"]}):E.title)})))};return l.a.createElement(l.a.Fragment,null,b&&d.length>1&&kn?l.a.createElement("div",{className:I()(Le.space,"dxy-comment-disabled")}):null,l.a.createElement(sn.StickyContainer,null,b&&d.length>1?kn?l.a.createElement(sn.Sticky,null,function(N){var P=N.style;return fe({style:h(h({},P),{top:"".concat(Z,"PX")})})}):fe({style:{position:"fixed"}}):null,l.a.createElement("div",{className:Le["tabs-content"]},e.children)))},bi=Object(p.forwardRef)(hi),xi=`.index-module_simple-module__8ylUA .ck-content p,.index-module_simple-module__8ylUA .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__8ylUA [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__8ylUA [data-menu-index='1'] h1,.index-module_simple-module__8ylUA [data-menu-index='1'] h2,.index-module_simple-module__8ylUA [data-menu-index='1'] h3,.index-module_simple-module__8ylUA [data-menu-index='1'] h4,.index-module_simple-module__8ylUA [data-menu-index='1'] h5,.index-module_simple-module__8ylUA [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__8ylUA [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_expert-list__AQxBB {
  box-sizing: border-box;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 0 0 20px;
  margin: 16px 0 0;
  overflow-x: scroll;
  color: #666;
  list-style-type: none;
  font-weight: 400;
}
.index-module_expert-list__AQxBB::-webkit-scrollbar {
  display: none;
}
.index-module_expert-list__AQxBB .index-module_footer__HvA3C {
  height: 1px;
  padding-right: 20px;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b {
  box-sizing: border-box;
  display: flex;
  flex: 1 0 12.5rem;
  align-items: center;
  justify-content: flex-start;
  height: 3.25rem;
  padding: 8px 12px;
  margin: 0 0 0 8px;
  font-size: 0.75rem;
  color: #666;
  background-color: #f5f6f9;
  border-radius: 0.75rem;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b:first-child {
  margin-left: 0;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b .index-module_avatar__R-AXe {
  flex: none;
  width: 2.25rem;
  height: 2.25rem;
  margin-right: 8px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  border-radius: 1.125rem;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b .index-module_item__oEAlX .index-module_expert-header__0XlhU {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-size: 0.625rem;
  color: #b49060;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b .index-module_item__oEAlX .index-module_expert-header-name__DDDMg {
  font-size: 0.75rem;
  color: #333;
  font-weight: 500;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b .index-module_item__oEAlX .index-module_expert-header-icon__6IGHR {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  margin: 0 2px 0 4px;
  background: url('data:image/png;base64,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') center / contain no-repeat;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b .index-module_item__oEAlX .index-module_expert-content__SyUhW {
  margin-top: 2px;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #999;
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 1;
  /*! autoprefixer: off */
  -webkit-box-orient: vertical;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b.index-module_flex__YP-27 {
  flex: 1;
}
.index-module_expert-list__AQxBB .index-module_expert-card__WME1b.index-module_more__E8JFG {
  flex: none;
  padding: 8px 20px;
  line-height: 1.0625rem;
}
`,Ee={"simple-module":"index-module_simple-module__8ylUA","expert-list":"index-module_expert-list__AQxBB",footer:"index-module_footer__HvA3C","expert-card":"index-module_expert-card__WME1b",avatar:"index-module_avatar__R-AXe",item:"index-module_item__oEAlX","expert-header":"index-module_expert-header__0XlhU","expert-header-name":"index-module_expert-header-name__DDDMg","expert-header-icon":"index-module_expert-header-icon__6IGHR","expert-content":"index-module_expert-content__SyUhW",flex:"index-module_flex__YP-27",more:"index-module_more__E8JFG"};ve(xi);var gi=Object(p.memo)(function(o){var e=o.auditExperts,n=o.title,i=o.id;return l.a.createElement(l.a.Fragment,null,(e==null?void 0:e.length)?l.a.createElement("ul",{className:I()(Ee["expert-list"],"dxy-comment-disabled")},e.slice(0,3).map(function(t,r){var a=t.authorName,d=t.department,s=t.rank,u=t.avatar;return l.a.createElement("li",{key:r,className:I()(Ee["expert-card"],e.length<2&&Ee.flex),onClick:function(){return _.redirectAuditDetail({id:i,title:n})}},u?l.a.createElement("div",{className:Ee.avatar,style:{backgroundImage:"url('".concat(u,"')")}}):null,l.a.createElement("div",{className:Ee.item},l.a.createElement("div",{className:Ee["expert-header"]},l.a.createElement("span",{className:Ee["expert-header-name"]},a),l.a.createElement("span",{className:Ee["expert-header-icon"]}),l.a.createElement("span",null,"\u5BA1\u6838\u4E13\u5BB6")),l.a.createElement("div",{className:Ee["expert-content"]},d," ",s)))}),e.length>3?l.a.createElement("li",{key:"more",className:I()(Ee["expert-card"],Ee.more),onClick:function(){return _.redirectAuditDetail({id:i,title:n})}},l.a.createElement("div",null,"\u67E5\u770B"),l.a.createElement("div",null,"\u66F4\u591A")):null,l.a.createElement("div",{className:Ee.footer})):null)}),yi=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_bottom__EySF- {
  position: relative;
  padding-bottom: 0;
  padding-bottom: calc(constant(safe-area-inset-bottom));
  padding-bottom: calc(env(safe-area-inset-bottom));
}
.index-module_bottom__EySF-::before {
  position: absolute;
  top: 0;
  left: 50%;
  width: 3.75rem;
  content: ' ';
  border-top: 1px solid #e0e0e0;
  transform: translateX(-50%) scaleY(0.5);
}
.index-module_bottom__EySF- .index-module_logo__pQum5 {
  width: 4.4375rem;
  height: 1.4375rem;
  margin: 16px auto 0;
  background: url('data:image/png;base64,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') center / contain no-repeat;
}
.index-module_bottom__EySF- .index-module_desc__etn2K {
  margin-top: 4px;
  margin-bottom: 16px;
  font-size: 0.5rem;
  line-height: 0.6875rem;
  color: #ccc;
  text-align: center;
}
`,mt={bottom:"index-module_bottom__EySF-",logo:"index-module_logo__pQum5",desc:"index-module_desc__etn2K"};ve(yi);var Oi=function(e){var n=e.type,i=e.className;return l.a.createElement("div",{className:I()(mt.bottom,i,"dxy-comment-disabled")},l.a.createElement("div",{className:mt.logo}),l.a.createElement("div",{className:mt.desc},"\u4E01\u9999\u56ED\u4E13\u4E1A\u533B\u5B66\u56E2\u961F",n==="audit"?"\u5BA1\u6838":"\u7814\u53D1"))};function Ci(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}function Xi(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}function Pi(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}function zi(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}var wt=.1,wi=function(e,n){var i;console.time("\u6BD4\u8F83\u5B57\u7B26\u4E32\u76F8\u4F3C\u5EA6");var t=(i=Object(yn.a)(e,n))!==null&&i!==void 0?i:0,r=t/n.length;return console.timeEnd("\u6BD4\u8F83\u5B57\u7B26\u4E32\u76F8\u4F3C\u5EA6"),r<wt},jt=function(e,n){var i;console.time("\u67E5\u627E\u6700\u76F8\u4F3C\u5B57\u7B26\u4E32\u4F4D\u7F6E");for(var t=n.length,r=t,a=-1,d=0,s=e.length;d<=s-t;d++){var u=e.slice(d,d+t),c=(i=Object(yn.a)(u,n))!==null&&i!==void 0?i:0;r>c&&(r=c,a=d)}var m=r/t;return console.timeEnd("\u67E5\u627E\u6700\u76F8\u4F3C\u5B57\u7B26\u4E32\u4F4D\u7F6E"),m<wt?a:null},vt=function(e){var n=e.text,i=e.selectedText,t=e.contexts,r=e.isWebWorker,a=t||[],d=a[0],s=d===void 0?"":d,u=a[1],c=u===void 0?"":u,m="".concat(s).concat(i).concat(c);if(n.indexOf(m)>-1){var f=n.indexOf(m)+s.length,v=f+i.length;return{startOffset:f,endOffset:v}}else if(s&&n.indexOf("".concat(s).concat(i))>-1){var f=n.indexOf("".concat(s).concat(i))+s.length,v=f+i.length;return{startOffset:f,endOffset:v}}else if(c&&n.indexOf("".concat(i).concat(c))>-1){var f=n.indexOf("".concat(i).concat(c)),v=f+i.length;return{startOffset:f,endOffset:v}}else if(n.indexOf(i)>-1){var f=n.indexOf(i),v=f+i.length;return{startOffset:f,endOffset:v}}else{if(r){var A=s?n.indexOf(s):0,g=c?n.indexOf(c,A+s.length):n==null?void 0:n.length;if(A>-1&&g>-1&&wi(n.slice(A+s.length,g),i))return{startOffset:A+s.length,endOffset:g,modified:!0};var y=jt(n,m);if(typeof y=="number"){var x=n.slice(y,m.length),j=jt(x,i);return typeof j=="number"?{startOffset:y+j,endOffset:Math.min(n.length,y+j+i.length),modified:!0}:{startOffset:Math.min(y+s.length,n.length),endOffset:Math.min(y+s.length+i.length,n.length),modified:!0}}}return null}},zn=null,Xe=function(e){return(e==null?void 0:e.nodeType)===Node.TEXT_NODE},he=function(e){return(e==null?void 0:e.nodeType)===Node.ELEMENT_NODE},wn=function(e){return typeof HTMLElement!="undefined"?(e==null?void 0:e.nodeType)===Node.ELEMENT_NODE&&e instanceof HTMLElement:!1},ft=function(e){return(e==null?void 0:e.nodeType)===Node.DOCUMENT_FRAGMENT_NODE},ji=function(e){return!!(e&&he(e))},Ni=function(e){return he(e)?e.nodeName==="IMG":!1},qe;(function(o){o[o.PROCESSING=1]="PROCESSING",o[o.MODIFIED=2]="MODIFIED",o[o.INVALID=3]="INVALID"})(qe||(qe={}));var We;(function(o){o[o.NORMAL=1]="NORMAL",o[o.SHARE=2]="SHARE",o[o.QUERY=3]="QUERY"})(We||(We={}));var Fn=500,Nt=function(e){var n,i,t,r=(n=e.showContent||e.content)===null||n===void 0?void 0:n.replace(/(<font\s+color="[#a-zA-Z0-9]+">|<\/font>)/gi,""),a=(t=(i=r==null?void 0:r.trim())===null||i===void 0?void 0:i.replace(/\.\.\.$/,""))===null||t===void 0?void 0:t.replace(/^\.\.\./,""),d={contexts:["",""],id:Object(Je.a)(),anchor:e.fieldName,type:We.QUERY,fragments:[],text:a==null?void 0:a.replace(/\[[\d-,，]+\]/g,"")};return d},ki=function(){function o(e){var n=this,i,t;this.tasks=new Map,this.debounceResize=Ln()(this.parseComments,100).bind(this),this.isAndroid=Rt()||Zt(),this._isMousemoving=!1,this.reached=!0,this.lazyComments=new Map,this.options=e,!((i=e.comments)===null||i===void 0?void 0:i.length)&&e.commentId&&(this.options.commentId=void 0),this._onSelectionChange=this._onSelectionChange.bind(this),this._onCommentTap=this._onCommentTap.bind(this),this._togglePopover=this._togglePopover.bind(this),this._hidePopover=this._hidePopover.bind(this),this._setMousemovingStatus=this._setMousemovingStatus.bind(this),this.removeCommentFromId=this.removeCommentFromId.bind(this),this.cancelSelect=this.cancelSelect.bind(this),this.scrollToComment=this.scrollToComment.bind(this),((t=this.options)===null||t===void 0?void 0:t.query)&&!this.options.shareComment&&(this.options.shareComment=Nt(this.options.query)),(this.options.commentId||this.options.shareComment)&&(this.reached=!1),this.init(),Promise.resolve().then(function(){return n.parseComments()})}return o.prototype.getResults=function(){var e=this,n,i,t=function(a){var d,s,u,c,m;if((d=a.anchor)===null||d===void 0?void 0:d.includes("&__&"))return(s=a.anchor)===null||s===void 0?void 0:s.slice(0,a.anchor.indexOf("&__&"));if(a.anchor)return a.anchor;var f=(u=a.fragments)===null||u===void 0?void 0:u.find(function(v){return v.anchor});return((c=f==null?void 0:f.anchor)===null||c===void 0?void 0:c.includes("&__&"))?(m=f.anchor)===null||m===void 0?void 0:m.slice(0,f.anchor.indexOf("&__&")):(f==null?void 0:f.anchor)||void 0};return Wn(Wn([],((n=this.options.comments)===null||n===void 0?void 0:n.map(function(r){var a=r.id,d=Ge(r,["id"]);return{anchor:d.anchor,underlineId:a,content:d.text,underlineStatus:d.status,fieldName:t(d),isSelf:!0,infoId:e.options.infoId,moduleType:e.options.moduleType,start:d.start,end:d.end}}))||[],!0),((i=this.options.otherComments)===null||i===void 0?void 0:i.map(function(r){var a=r.id,d=Ge(r,["id"]);return{anchor:d.anchor,underlineId:a,content:d.text,underlineStatus:d.status,infoId:e.options.infoId,moduleType:e.options.moduleType,fieldName:t(d),isSelf:!1,start:d.start,end:d.end}}))||[],!0).sort(function(r,a){if(typeof r.start=="number"&&typeof a.start=="number")return r.start-a.start;var d=document.querySelector('u[data-id="'.concat(r.underlineId,'"]')),s=document.querySelector('u[data-id="'.concat(a.underlineId,'"]'));if(d&&s){var u=d.compareDocumentPosition(s);switch(u){case Node.DOCUMENT_POSITION_CONTAINS:case Node.DOCUMENT_POSITION_PRECEDING:return 1;case Node.DOCUMENT_POSITION_FOLLOWING:case Node.DOCUMENT_POSITION_CONTAINED_BY:return-1;default:return 0}}else{if(r.anchor&&a.anchor){var c=e.options.sortAnchor(r.anchor,a.anchor);if(typeof c=="number")return c}return d?-1:s?1:0}})},o.prototype.init=function(){document.addEventListener("selectionchange",this._onSelectionChange),document.addEventListener("click",this._onCommentTap),document.addEventListener("touchend",this._togglePopover),document.addEventListener("mouseup",this._togglePopover),document.addEventListener("mousedown",this._setMousemovingStatus),document.addEventListener("mousemove",this._setMousemovingStatus),document.addEventListener("touchmove",this._hidePopover),_.addEventListener("goto",this.scrollToComment),_.addEventListener("removeComment",this.removeCommentFromId),an(yt,this.debounceResize)},o.prototype.parseComments=function(){var e;return C(this,void 0,void 0,function(){var n,i,t,r,a,d,s,u,c,m,f=this;return X(this,function(v){switch(v.label){case 0:if(n=this.options.comments,i=this.options.otherComments,t=this.options.shareComment,!((n==null?void 0:n.length)||(i==null?void 0:i.length)||t))return[3,16];if(console.time("\u56DE\u663E\u5212\u7EBF"),!(typeof window!="undefined"&&window.Worker&&!this.worker))return[3,7];v.label=1;case 1:return v.trys.push([1,6,,7]),[4,w.e(6).then(w.bind(null,"Kz4v"))];case 2:return r=v.sent().default,a=new Blob([r],{type:"application/javascript"}),d=URL.createObjectURL(a),this.worker=new Worker(d),[3,5];case 3:return[4,w.e(39).then(w.bind(null,"s0OB")).then(function(A){var g=A.default;return g})];case 4:s=v.sent(),this.worker=new s,v.label=5;case 5:return this.worker.onmessage=function(A){var g=A.data,y=g.id,x=g.jobId,j=g.data,R=f.tasks.get(y),Z=R==null?void 0:R.get(x);Z&&(Z(j),R==null||R.delete(x),(R==null?void 0:R.size)||f.tasks.delete(y))},this.worker.onmessageerror=function(A){var g;(g=f.worker)===null||g===void 0||g.terminate(),f.worker=null,console.error("web worker message \u62A5\u9519",A)},this.worker.addEventListener("error",function(A){var g;(g=f.worker)===null||g===void 0||g.terminate(),f.worker=null,console.error("web worker \u62A5\u9519",A)}),[3,7];case 6:return v.sent(),(e=this.worker)===null||e===void 0||e.terminate(),this.worker=null,console.error("web worker \u521D\u59CB\u5316\u5931\u8D25"),[3,7];case 7:return(i==null?void 0:i.length)?this.options.readable?[4,Promise.all(i.map(function(A){return C(f,void 0,void 0,function(){return X(this,function(g){return[2,this.parseComment(A,!1)]})})}))]:[3,9]:[3,11];case 8:return v.sent(),[3,11];case 9:return this.options.shareComment?(u=i.find(function(A){var g;return A.id===((g=f.options.shareComment)===null||g===void 0?void 0:g.id)}),u?[4,this.parseComment(u,!1)]:[3,11]):[3,11];case 10:v.sent(),v.label=11;case 11:return(n==null?void 0:n.length)?[4,Promise.all(n.map(function(A){return C(f,void 0,void 0,function(){return X(this,function(g){return[2,this.parseComment(A,!0)]})})}))]:[3,13];case 12:v.sent(),v.label=13;case 13:return c=document.querySelector("u[data-id]:not([data-self])"),c&&(m=c.getClientRects(),this.options.onTips({scrollTop:document.documentElement.scrollTop||document.body.scrollTop,rects:m,isSelfComment:!1})),!this.reached&&t?(this.reached=!0,[4,this.scrollToShareComment()]):[3,15];case 14:v.sent(),v.label=15;case 15:dn(at),console.timeEnd("\u56DE\u663E\u5212\u7EBF"),v.label=16;case 16:return _.updateComments({results:this.getResults()}),[2]}})})},o.prototype.findMatchedPosition=function(e,n){return C(this,void 0,void 0,function(){var i,t,r,a,d,s,u,c=this;return X(this,function(m){return console.log("\u5F00\u59CB\u67E5\u627E\u5212\u7EBF\u5185\u5BB9...",n),i=n.id,t=n.text,r=t===void 0?"":t,a=n.contexts,this.worker?(d=this.worker,this.tasks.has(i)||this.tasks.set(i,new Map),s=this.tasks.get(i),(s==null?void 0:s.size)&&s.clear(),u=Object(Je.a)(),[2,new Promise(function(f){console.log("\u53D1\u9001\u5212\u7EBF\u5185\u5BB9...",n),d.postMessage({selectedText:r,contexts:a,text:e,id:i,jobId:u}),console.log("\u53D1\u9001\u6570\u636E\u5B8C\u6210...");var v=function(){return console.log("web worker \u62A5\u9519\uFF0C\u964D\u7EA7\u672C\u5730\u5904\u7406..."),d.removeEventListener("error",v),d==null||d.terminate(),c.worker=null,s==null||s.delete(u),f(vt({text:e,selectedText:r,contexts:a}))};d.addEventListener("error",v),s==null||s.set(u,function(A){return d.removeEventListener("error",v),console.log("\u67E5\u627E\u7ED3\u675F",n,A),f(A)})}).catch(function(){return console.error("\u67E5\u627E\u5931\u8D25...",n),null})]):(console.log("\u672C\u5730\u67E5\u627E\u5212\u7EBF\u5185\u5BB9...",n),[2,vt({text:e,selectedText:r,contexts:a})])})})},o.prototype.scrollToComment=function(e,n){var i,t,r;return C(this,void 0,void 0,function(){var a,d,s,u,c,m,f,v,A,g;return X(this,function(y){if("commentId"in e){if(a=e.commentId,this.lazyComments.has(a)&&(d=this.lazyComments.get(a),s=d.node,u=d.range,c=d.options,this._wrapCommentRange(s,u,a,c)),m=n||((i=this.options.comments)===null||i===void 0?void 0:i.find(function(x){return x.id===a})),f=document.querySelector('u[data-id="'.concat(a,'"]')),f)return v=st(f),v?dn(Ot,{el:v}):Object(De.a)(f,{block:"center",skipOverflowHiddenElements:!1,behavior:"smooth"}),(m==null?void 0:m.status)===qe.MODIFIED&&(m==null?void 0:m.underlineType)!==We.QUERY&&m.type!==We.QUERY&&Ae.c.show({content:l.a.createElement("div",{style:{textAlign:"center"}},[l.a.createElement("div",null,["\u4F60\u5212\u7EBF\u7684\u5185\u5BB9\u6709\u66F4\u65B0"]),l.a.createElement("div",null,["\u8BF7\u4EE5\u6700\u65B0\u5185\u5BB9\u4E3A\u51C6"])])}),[2,this._lightComment(a)];A=((r=(t=m==null?void 0:m.fragments)===null||t===void 0?void 0:t[0])===null||r===void 0?void 0:r.anchor)||(m==null?void 0:m.anchor),A&&setTimeout(function(){var x;(x=window.goto)===null||x===void 0||x.call(window,A)},200),this.options.readable&&(m==null?void 0:m.type)!==We.QUERY&&(m==null?void 0:m.underlineType)!==We.QUERY&&Ae.c.show({content:l.a.createElement("div",{style:{textAlign:"center"}},[l.a.createElement("div",null,["\u4F60\u5212\u7EBF\u7684\u5185\u5BB9\u5DF2\u5220\u9664"]),l.a.createElement("div",null,["\u8BF7\u4EE5\u6700\u65B0\u5185\u5BB9\u4E3A\u51C6"])])})}else g=e==null?void 0:e.cellId,g&&setTimeout(function(){var x;(x=window.goto)===null||x===void 0||x.call(window,g)},200);return[2]})})},o.prototype._removeHotComment=function(e){var n;this.options.otherComments=(n=this.options.otherComments)===null||n===void 0?void 0:n.filter(function(i){return!i.isSelf&&i.id!==e})},o.prototype._updateCommentStatus=function(e){var n;this.options.readable&&(this.options.comments=(n=this.options.comments)===null||n===void 0?void 0:n.map(function(i){return i.id===e.id?h(h({},i),{status:e.status}):i}))},o.prototype._getAnchorNode=function(e){var n=this,i=document.querySelectorAll('[data-menu-anchor="'.concat(e,'"]'));if(i==null?void 0:i.length)return Array.from(i).find(function(t){return n._isInValidNode(t)})},o.prototype._getCommentRange=function(e){var n;return C(this,void 0,void 0,function(){var i,t,r,a,d,s=this;return X(this,function(u){for(i=function(m){return C(s,void 0,void 0,function(){var f,v,A,g,y,x,j,R,Z,W,K,D=this;return X(this,function(ee){switch(ee.label){case 0:return f="",v=function(H){if(Xe(H)&&H.nodeValue){var k=H.nodeValue;f+=k}else D._isValidNode(H)&&H.childNodes.forEach(v)},v(m),[4,this.findMatchedPosition(f,e)];case 1:return A=ee.sent(),A?(g=A.startOffset,y=A.endOffset,x=A.modified,j=x===void 0?!1:x,R=document.createRange(),Z=0,W=!1,K=function(H){if(!W)if(Xe(H)&&H.nodeValue){var k=H.nodeValue,b=Z+k.length;Z<=g&&b>g?(R.setStart(H,g-Z),b>=y&&(R.setEnd(H,y-Z),W=!0)):Z<y&&b>=y&&(R.setEnd(H,y-Z),W=!0),Z+=k.length}else D._isValidNode(H)&&H.childNodes.forEach(K)},K(m),[2,{range:R,modified:j,root:m}]):[2,null]}})})},this._removeCommentFromId(e.id),t=(n=e.anchor)===null||n===void 0?void 0:n.replace(/"/g,'\\"');t&&(r=this._getAnchorNode(t),r&&r.hasAttribute("data-anchor-index"));)t.includes("&__&")?t=t.slice(0,t.lastIndexOf("&__&")):t=null;return t?(a=this._getAnchorNode(t),a?[2,i(a)]:[2,null]):(d=document.body,[2,i(d)])})})},o.prototype._lazyWrapCommentRange=function(e,n,i,t){return C(this,void 0,void 0,function(){var r,a,d,s=this;return X(this,function(u){if(!this.options.lazy)return this._wrapCommentRange(e,n,i,t),[2];if(r=n.commonAncestorContainer,!he(r))if(r.parentElement)r=r.parentElement;else return this._wrapCommentRange(e,n,i,t),[2];return a=null,d=new IntersectionObserver(function(c){var m=c[0].isIntersecting;a&&(clearTimeout(a),a=null),m&&(a=setTimeout(function(){s._wrapCommentRange(e,n,i,t),a=null},500))},{rootMargin:"200px 0px",threshold:[.01]}),d.observe(r),this.lazyComments.set(i,{node:e,range:n,options:t,ob:d}),[2]})})},o.prototype.parseComment=function(e,n){return C(this,void 0,void 0,function(){var i;return X(this,function(t){switch(t.label){case 0:return this._removeCommentFromId(e.id),[4,this._getCommentRange(e)];case 1:return i=t.sent(),i?(!n&&i.modified?this._removeHotComment(e.id):(this._lazyWrapCommentRange(i.root,i.range,e.id,{isSelf:n}),this._updateCommentStatus({id:e.id,status:i.modified?qe.MODIFIED:qe.PROCESSING})),i.range.detach()):(this._updateCommentStatus({id:e.id,status:qe.INVALID}),n||this._removeHotComment(e.id)),!this.reached&&this.options.commentId&&this.options.commentId===e.id&&(this.reached=!0,this.scrollToComment({commentId:e.id})),[2]}})})},o.prototype.scrollToShareComment=function(){return C(this,void 0,void 0,function(){var e,n,i=this;return X(this,function(t){switch(t.label){case 0:return this.options.shareComment?(e=this.options.shareComment.id,[4,this._getCommentRange(this.options.shareComment)]):[3,2];case 1:n=t.sent(),(n==null?void 0:n.range)&&this._wrapCommentRange(n.root,n.range,this.options.shareComment.id,{isSelf:!1}),this.scrollToComment({commentId:e},this.options.shareComment).then(function(){var r,a,d;((r=i.options.shareComment)===null||r===void 0?void 0:r.type)===We.QUERY&&!i.options.readable?i._removeCommentUnderline(e):((a=i.options.shareComment)===null||a===void 0?void 0:a.type)!==We.NORMAL&&((d=i.options.shareComment)===null||d===void 0?void 0:d.underlineType)!==We.NORMAL&&i._removeCommentFromId(e)}),t.label=2;case 2:return[2]}})})},o.prototype._isAllTextInSelfComment=function(e){var n=this;return Xe(e)?e.nodeValue?this._isInSelfCommentNode(e):!0:!this._isValidNode(e)||this._isInSelfCommentNode(e)?!0:Array.from(e.childNodes).every(function(i){return n._isAllTextInSelfComment(i)})},o.prototype._setMousemovingStatus=function(e){switch(e.type){case"mousedown":this._isMousemoving=!1;break;case"mousemove":e.buttons&&(e.movementX||e.movementY)&&(this._isMousemoving=!0);break}},o.prototype._hidePopover=function(){this.options.onPopover(null)},o.prototype._togglePopover=function(){if(this.range){var e=this.range.getClientRects(),n=this._getText(this.range.cloneContents()),i=this._isAllTextInSelfComment(this.range.commonAncestorContainer)||this._isAllTextInSelfComment(this.range.cloneContents());this.options.onPopover({rects:e,isSelfComment:i&&!!n,isCommentable:!!n})}else this.options.onPopover(null)},o.prototype._lightComment=function(e){return C(this,void 0,void 0,function(){return X(this,function(n){return e?[2,new Promise(function(i){setTimeout(function(){var t=document.createElement("style");t.textContent='u[data-id="'.concat(e,'"] { background-color: rgb(119 83 255 / 10%); }'),document.head.appendChild(t),setTimeout(function(){return document.head.removeChild(t),i()},1500)},500)})]:[2]})})},o.prototype._selectComment=function(e){var n,i,t;if(e){var r=document.createRange(),a=document.querySelectorAll('u[data-id="'.concat(e,'"]'));if(a.length){a.forEach(function(u){u.classList.add("dxy-comment-selection")});var d=(n=a.item(0))===null||n===void 0?void 0:n.firstChild,s=(i=a.item(a.length-1))===null||i===void 0?void 0:i.lastChild;return d&&r.setStart(d,0),s&&r.setEnd(s,Xe(s)?((t=s.textContent)===null||t===void 0?void 0:t.length)||0:s.childNodes.length),this.range=r,!0}}return!1},o.prototype._onCommentTap=function(e){var n=this,i=e.target;if(!this._isMousemoving){if(ji(i)){var t=this._findParentCommentNode(i);if(t){document.querySelectorAll(".dxy-comment-selection").forEach(function(s){s.classList.remove("dxy-comment-selection")});var r=t.getAttribute("data-id"),a=t.hasAttribute("data-self"),d=this._selectComment(r);d&&setTimeout(function(){n._togglePopover(),a||n.options.onTips(null)});return}}this.cancelSelect()}},o.prototype._onSelectionChange=function(e){var n,i,t,r=document.getSelection();r&&!r.isCollapsed&&((i=(n=this.options).onRangeChange)===null||i===void 0||i.call(n),this.range=(t=r.getRangeAt)===null||t===void 0?void 0:t.call(r,0)),this.isAndroid&&this._hidePopover()},o.prototype._findParentCommentNode=function(e){if(this._isCommentNode(e))return e;for(var n=e.parentNode;n;){if(this._isCommentNode(n))return n;if(this._isSpecialNode(n))n=n.parentNode;else return null}return null},o.prototype._isCommentNode=function(e){return he(e)?e.tagName==="U"&&e.hasAttribute("data-id"):!1},o.prototype._isInSelfCommentNode=function(e){var n=this._findParentCommentNode(e);return!!(n&&(n==null?void 0:n.hasAttribute("data-self")))},o.prototype._isSpecialNode=function(e){return he(e)?(e.tagName==="IMG"||e.tagName==="MARK"&&e.hasAttribute("data-markjs"))&&e.parentNode?this._isSpecialNode(e.parentNode):["SUB","SUP"].includes(e.tagName)||e.classList.contains("dxy-comment-special"):!1},o.prototype._isInValidNode=function(e){for(var n=e;n;){if(!this._isValidNode(n))return!1;n=n.parentNode}return!0},o.prototype._isValidNode=function(e){return he(e)?!e.classList.contains("dxy-comment-disabled"):!0},o.prototype._getFragments=function(){var e=this,n=this.range;if(n){for(var i=[],t=n.startContainer,r=this.getAnchor(t),a="",d=t;d;)if(d.previousSibling){if(d=d.previousSibling,he(d)&&!d.hasAttribute("data-menu-index")){var s=d.querySelectorAll("[data-menu-anchor]");if(s.length){a=s.item(s.length-1).getAttribute("data-menu-anchor");break}}}else d=d.parentNode;r&&(a!==r||a.indexOf("".concat(r,"&__&"))!==0)&&(a=r);var u=n.cloneContents(),c=new Map,m=function(v){if(e._isValidNode(v)&&(he(v)&&v.hasAttribute("data-menu-anchor")&&(a=v.getAttribute("data-menu-anchor"),c.has(a)||c.set(a,"")),v.hasChildNodes()&&v.childNodes.forEach(m),Xe(v)))if(c.has(a)){var A=c.get(a);c.set(a,"".concat(A).concat(e._getText(v)))}else c.set(a,e._getText(v))};return m(u),c.forEach(function(f,v){f&&i.push({anchor:v,text:f})}),i}return null},o.prototype._findRootAnchor=function(e){return(e==null?void 0:e.length)?e.reduce(function(n,i){var t,r,a;if(i.anchor===n||((t=i.anchor)===null||t===void 0?void 0:t.indexOf("".concat(n,"&__&")))===0)return n;for(var d=n.split("&__&"),s=((r=i.anchor)===null||r===void 0?void 0:r.split("&__&"))||[],u=Math.min(d.length,s==null?void 0:s.length),c=0;c<u;c++)if(d[c]!==s[c])return(a=d.slice(0,c))===null||a===void 0?void 0:a.join("&__&");return n},(e==null?void 0:e[0].anchor)||""):""},o.prototype._getFragmentHtml=function(e){var n=this;return Xe(e)?e.nodeValue||"":he(e)?e.outerHTML:ft(e)?Array.from(e.childNodes).reduce(function(i,t){return i+n._getFragmentHtml(t)},""):this._getText(e)},o.prototype._getContext=function(e,n,i){for(var t="",r="";e;){if(he(e)){var a=e.getAttribute("data-menu-anchor");if(a&&((i==null?void 0:i.anchor)&&i.anchor===a||(i==null?void 0:i.startAnchor)&&i.startAnchor===a))break}if(e.nodeName==="BODY")break;if(e.previousSibling?(e=e.previousSibling,t="".concat(this._getText(e)).concat(t)):e=e.parentNode,t.length>30){t=t.slice(t.length-30);break}}for(;n;){if(he(n)){var a=n.getAttribute("data-menu-anchor");if(a&&((i==null?void 0:i.anchor)&&i.anchor===a||(i==null?void 0:i.endAnchor)&&i.endAnchor===a))break}if(n.nodeName==="BODY")break;if(n.nextSibling?(n=n.nextSibling,r="".concat(r).concat(this._getText(n))):n=n.parentNode,r.length>30){r=r.slice(0,30);break}}return[t,r]},o.prototype._getShareNode=function(e,n,i){for(var t="",r="",a=n,d=i,s=!1;a;){if(a===e&&(s=!0),a.previousSibling)a=a.previousSibling,t="".concat(this._getText(a)).concat(t);else if(a.parentNode)a=a.parentNode;else break;if(wn(a)&&a.getAttribute("id")==="root")break;if(t.length>30&&(s||(a==null?void 0:a.parentNode)===e)){t=t.slice(t.length-30);break}}for(;d;){if(d===e&&(s=!0),d.nextSibling)d=d.nextSibling,r="".concat(r).concat(this._getText(d));else if(d.parentNode)d=d.parentNode;else break;if(wn(d)&&d.getAttribute("id")==="root")break;if(r.length>30&&(s||(d==null?void 0:d.parentNode)===e)){r=r.slice(0,30);break}}for(;a&&!a.contains(d);)a=a.parentNode;a&&!wn(a)&&(a=a.parentElement);var u=a;if(u.querySelector("table,tr,td,th")){if(!u.querySelector('[data-simplebar="init"]'))for(;u&&u.getAttribute("data-simplebar")!=="init";)u=u.parentElement;(u==null?void 0:u.parentElement)&&u.parentElement.nodeName==="FIGURE"&&(u=u.parentElement)}return u},o.prototype._getText=function(e){var n=this;if(this._isValidNode(e)){if(Xe(e))return e.nodeValue||"";if(he(e)||ft(e))return e.querySelector(".dxy-comment-disabled")?Array.from(e.childNodes).reduce(function(i,t){return i+n._getText(t)},""):e.nodeName==="HEAD"?"":e.textContent||""}return""},o.prototype._getSharedText=function(e){var n=this,i;if(this._isValidNode(e)||this._isSpecialNode(e)){if(Xe(e))return e.textContent||"";if(he(e)||ft(e)){var t=(i=Array.from(e.childNodes).reduce(function(a,d){return a+n._getSharedText(d)},""))===null||i===void 0?void 0:i.replace(/(\n)+/g,`
`);if(he(e))if(/^(sub|sup)$/i.test(e.tagName)){var r=e.tagName.toLowerCase();return"<".concat(r,">").concat(t,"</").concat(r,">")}else{if(/^(div|p|ul|ol|figure|ficaption|li|h[1-6])$/i.test(e.tagName))return"".concat(t,`
`);if(/^(table|tbody|tr)$/i.test(e.tagName))return""}return t}}return""},o.prototype._checkNodeRange=function(e,n,i,t){var r=((t==null?void 0:t.doc)||document).createRange();if(r.selectNodeContents(e),!!e.isConnected){if(this._cleanLazyNode(i),Xe(e)){if(n.compareBoundaryPoints(Range.START_TO_START,r)!==1){if(n.compareBoundaryPoints(Range.END_TO_END,r)!==-1)this._wrapNode(e,i,t);else if(n.compareBoundaryPoints(Range.START_TO_END,r)===1){var a=n.endOffset;e.splitText(a),this._wrapNode(e,i,t)}}else if(n.compareBoundaryPoints(Range.END_TO_START,r)===-1)if(n.compareBoundaryPoints(Range.END_TO_END,r)!==-1){var d=n.startOffset;e.splitText(d),this._wrapNode((e==null?void 0:e.nextSibling)||e,i,t)}else{var d=n.startOffset,a=n.endOffset;e.splitText(a),e.splitText(d),this._wrapNode((e==null?void 0:e.nextSibling)||e,i,t)}}else if(this._isSpecialNode(e)){if(n.compareBoundaryPoints(Range.START_TO_END,r)===-1||n.compareBoundaryPoints(Range.END_TO_START,r)===1)return;this._wrapNode(e,i,t)}}},o.prototype._wrapCommentRange=function(e,n,i,t){var r=this;Xe(e)||this._isSpecialNode(e)?this._checkNodeRange(e,n,i,t):this._isValidNode(e)&&Array.from(e.childNodes).forEach(function(a){r._wrapCommentRange(a,n,i,t)})},o.prototype._normalizeComment=function(e){var n=e.previousSibling;if(this._isCommentNode(e)&&n){var i=e.hasAttribute("data-self"),t=e.getAttribute("data-id");if(he(n)&&this._isCommentNode(n)){var r=n.getAttribute("data-id"),a=n.hasAttribute("data-self");if(a===i&&t===r){for(var d=n.lastChild;d;){var s=d.previousSibling;e.prepend(d),d=s}e.normalize(),n.remove()}}}},o.prototype._wrapNode=function(e,n,i){for(var t,r,a=i.isSelf,d=e;d;){var s=d.parentNode;if(s&&this._isSpecialNode(s)&&d.parentNode)d=d.parentNode;else break}var u=this._findParentCommentNode(e);if(u){var c=u.getAttribute("data-id");if(a&&this._isInSelfCommentNode(e)){c!==n&&document.querySelectorAll('u[data-self][data-id="'.concat(c,'"]')).forEach(function(v){v.setAttribute("data-id",n)}),this._normalizeComment(u);return}else if(c===n)return}var m=this._createComment();m.setAttribute("data-id",n),a&&m.setAttribute("data-self","");var f=d.nextSibling;f?(t=d.parentNode)===null||t===void 0||t.insertBefore(m,f):(r=d.parentNode)===null||r===void 0||r.appendChild(m),m.appendChild(d),this._normalizeComment(m)},o.prototype._createComment=function(){var e=document.createElement("u");return e},o.prototype._unwrap=function(e){var n=e.parentNode;if(he(e)&&n){for(var i=e.firstChild;i;){var t=i.nextSibling;n.insertBefore(i,e),i=t}n.removeChild(e),n.normalize()}},o.prototype.getAnchor=function(e){for(var n=e;n;){if(he(n)&&n.hasAttribute("data-menu-anchor"))return n.getAttribute("data-menu-anchor");n=n.parentNode}return null},o.prototype._createCommentId=function(e){var n=e.querySelector("u[data-self]");return n?n.getAttribute("data-id"):Object(Je.a)()},o.prototype._collectSelfComment=function(e){var n=new Set,i=function(r){he(r)&&r.tagName==="U"&&r.hasAttribute("data-self")?n.add(r):Array.from(r.childNodes).forEach(function(a){return i(a)})};return i(e),n},o.prototype._cleanLazyNode=function(e){if(this.lazyComments.has(e)){var n=this.lazyComments.get(e),i=n.ob,t=n.range;i.disconnect(),t.detach(),this.lazyComments.delete(e)}},o.prototype._removeCommentFromId=function(e){var n=this;e&&(this._cleanLazyNode(e),document.querySelectorAll('u[data-id="'.concat(e,'"]')).forEach(function(i){n._unwrap(i)}))},o.prototype._removeCommentUnderline=function(e){e&&(this._cleanLazyNode(e),document.querySelectorAll('u[data-id="'.concat(e,'"]')).forEach(function(n){n.style.borderBottom="none"}))},o.prototype._isInvalidShareNode=function(e){return e.nodeName==="HTML2CANVASPSEUDOELEMENT"?!0:!this._isValidNode(e)&&!this._isSpecialNode(e)||this._isSpecialNode(e)&&e.firstChild&&Ni(e.firstChild)},o.prototype._getAvailableArea=function(e){var n=e.getClientRects(),i=Math.min.apply(Math,Array.from(n).map(function(d){return d.top})),t=Math.max.apply(Math,Array.from(n).map(function(d){return d.bottom})),r=Math.min.apply(Math,Array.from(n).map(function(d){return d.left})),a=Math.max.apply(Math,Array.from(n).map(function(d){return d.right}));return{left:r,top:i,right:a,bottom:t}},o.prototype._removeShareTag=function(){var e=document.querySelector('span[data-type="start"]'),n=document.querySelector('span[data-type="end"]');e&&e.remove(),n&&n.remove()},o.prototype.selectRange=function(){var e=this.range;if(e){var n=window.getSelection();n==null||n.empty(),n==null||n.addRange(e)}},o.prototype.cancelSelect=function(){document.querySelectorAll(".dxy-comment-selection").forEach(function(n){n.classList.remove("dxy-comment-selection")}),this.range&&(this.range.detach(),this.range=null);var e=window.getSelection();e&&e.empty(),this.options.onPopover(null)},o.prototype.getShareSelection=function(){var e,n,i;return C(this,void 0,void 0,function(){var t,r,a,d,s,u,c,m,f,v,A,g,y,x,g,j,R,Z,W,K,D,ee,Y,H,k,b,M=this;return X(this,function(V){switch(V.label){case 0:return V.trys.push([0,4,,5]),this.range?(t=this.range,r=t.cloneContents(),a=((e=this._getText(r))===null||e===void 0?void 0:e.replace(/(\n)+$/g,""))||"",a?a.length>Fn?(Ae.c.show({content:"\u5355\u6B21\u5206\u4EAB\u4E0A\u9650\u4E3A ".concat(Fn," \u5B57"),maskStyle:{zIndex:9999}}),[2,null]):(this.options.onImageGenerating(),d=Math.min(document.body.clientWidth,650)-16,s=this._getFragments()||[],u=this._findRootAnchor(s),c=this._getFragmentHtml(r),m=Object(Je.a)(),f=t.startContainer,f&&(v=document.createElement("span"),v.dataset.shareId=m,v.dataset.type="start",v.classList.add("dxy-comment-disabled"),Xe(f)?(f.splitText(t.startOffset),f.nextSibling&&(A=f.nextSibling,(n=f.parentNode)===null||n===void 0||n.insertBefore(v,A),f=A)):(g=f.childNodes.item(t.startOffset),f.insertBefore(v,g))),y=t.endContainer,y&&(x=document.createElement("span"),x.dataset.shareId=m,x.dataset.type="end",x.classList.add("dxy-comment-disabled"),Xe(y)?(y.splitText(t.endOffset),y.nextSibling&&((i=y.parentNode)===null||i===void 0||i.insertBefore(x,y.nextSibling))):(g=y.childNodes.item(t.endOffset),y.insertBefore(x,g))),j=this._getContext(f,y,{anchor:u}),R={id:m,type:We.SHARE,text:a,anchor:u,contexts:j,fragments:s,fragment:c,status:qe.PROCESSING},[4,this.options.onShare({comment:R})]):(Ae.c.show({content:"\u5F53\u524D\u5206\u4EAB\u65E0\u610F\u4E49\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u5206\u4EAB\u5185\u5BB9",maskStyle:{zIndex:9999}}),[2,null])):[3,3];case 1:return Z=V.sent(),Z?(W=3,K=this._getShareNode(t.commonAncestorContainer,t.startContainer,t.endContainer)||document.querySelector("#root"),D=1,ee=function(J,Q){return C(M,void 0,void 0,function(){var G,oe,pe,ye,ze,be=this;return X(this,function(kn){return ye=24*5,ze=12,console.time("\u7ED8\u56FE".concat(D)),[2,gn()(J,{windowWidth:d-2*ze,y:Q==null?void 0:Q.offsetY,height:Q==null?void 0:Q.canvasHeight,scale:W,allowTaint:!0,useCORS:!0,backgroundColor:"#F5F6F9",onclone:function(de,xe){var le=de.createRange();de.body.classList.add("dxy-comment-share"),de.body.style.fontSize="18px",de.documentElement.style.fontSize="18px";var _e=!1,Pe=!1,ue=function(O){var B,U,q,$;if(he(O)&&O.getAttribute("data-share-id")===m&&(O.getAttribute("data-type")==="start"?(_e=!0,le.setStartAfter(O)):O.getAttribute("data-type")==="end"&&(Pe=!0,le.setEndBefore(O))),be._isInvalidShareNode(O))(B=O.parentNode)===null||B===void 0||B.removeChild(O);else if(Xe(O)){var ne=de.createElement("span");ne.innerText=(U=O.data)===null||U===void 0?void 0:U.replace(/（(\d+)）/g,function(we,Ke){return"(".concat(Ke,") ")}),ne.style.color="#ccc",O.replaceWith(ne)}else if(be._isCommentNode(O)||wn(O)&&((q=O.className)===null||q===void 0?void 0:q.includes("simplebar-"))&&!O.classList.contains("simplebar-content-wrapper")){for(var te=O.firstChild;te;){var Ce=te.nextSibling;($=O.parentNode)===null||$===void 0||$.insertBefore(te,O),ue(te),te=Ce}O.remove();return}else if(O.hasChildNodes())for(var te=O.firstChild;te;){var Ce=te.nextSibling;ue(te),te=Ce}};ue(xe),_e!==Pe&&(Pe?(le.setStartBefore(xe),_e=!0):(le.setEndAfter(xe),Pe=!0));var fe=be._getAvailableArea(le);G=fe.top,pe=fe.right,oe=fe.bottom,G+=de.documentElement.scrollTop||de.body.scrollTop,oe+=de.documentElement.scrollTop||de.body.scrollTop;for(var N=xe;N&&wn(N);)G-=N.offsetTop,oe-=N.offsetTop,N=N==null?void 0:N.offsetParent;var P=xe.querySelectorAll(".simplebar-content-wrapper");if(P.forEach(function(z){if(le.comparePoint(z,0)===-1&&le.comparePoint(z,z.children.length)===1){var O=z.getBoundingClientRect().width;z.scrollLeft+=Math.max(pe-O,0)}}),_e&&Pe){be._wrapCommentRange(xe,le,m,{isSelf:!0,doc:de});var E=xe.querySelectorAll('u[data-self][data-id="'.concat(m,'"'));if(E==null?void 0:E.length){var L=new Set,S=function(O){Xe(O)&&O.parentElement?L.add(O.parentElement):O.hasChildNodes()&&O.childNodes.forEach(S)};E.forEach(function(z){z.style.borderBottom="none",z.style.textDecoration="none",S(z)}),L.forEach(function(z){z.style.color="#333"})}}}}).then(function(Oe){G-=(Q==null?void 0:Q.offsetY)||0,oe-=(Q==null?void 0:Q.offsetY)||0;var de=Math.max(G-ye,0),xe=Math.min(oe+ye,Oe.height/W),le=xe-de,_e=Oe.toDataURL("image/png");if(console.timeEnd("\u7ED8\u56FE".concat(D)),_e==="data:,"&&D--)return ee(J,{offsetY:de,canvasHeight:le});var Pe=Oe.getContext("2d");Pe==null||Pe.resetTransform(),Pe==null||Pe.scale(W,W);var ue=document.createElement("canvas"),fe=ue.getContext("2d");ue.width=d*W,ue.style.width="".concat(d,"px"),ue.height=le*W,ue.style.height="".concat(le,"px");var N=Math.min(Oe.width,d*W);if(fe){fe.fillStyle="rgba(245, 246, 249, 1)",fe.fillRect(0,0,ue.width,ue.height);var P=(d*W-N)/2;if(fe==null||fe.drawImage(Oe,0,de*W,N,le*W,P,0,N,le*W),G>de){var E=G-de,L=fe.createLinearGradient(0,0,0,E*W);L.addColorStop(0,"rgba(245, 246, 249, 1)"),L.addColorStop(1,"rgba(245, 246, 249, 0)"),fe.fillStyle=L,fe.fillRect(0,0,ue.width,E*W)}if(xe>oe){var S=xe-oe,z=fe.createLinearGradient(0,ue.height-S*W,0,ue.height);z.addColorStop(0,"rgba(245, 246, 249, 0)"),z.addColorStop(1,"rgba(245, 246, 249, 1)"),fe.fillStyle=z,fe.fillRect(0,ue.height-S*W,ue.width,S*W)}}return ue.toDataURL("image/png")})]})})},[4,ee(K)]):(this._removeShareTag(),Ae.c.show({content:"\u670D\u52A1\u5668\u7E41\u5FD9\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5",maskStyle:{zIndex:9999}}),[2,null]);case 2:return Y=V.sent(),this._removeShareTag(),H=this._isAllTextInSelfComment(t.commonAncestorContainer),k=void 0,H||(k=this.comment()),b=u,this.cancelSelect(),[2,h(h({id:m,selectedText:a,anchor:b},k),{imageString:Y})];case 3:return[2,null];case 4:return V.sent(),[2,null];case 5:return[2]}})})},o.prototype.getPlainSelection=function(e){if(this.range){var n=this.range,i=n.cloneContents(),t=this._getText(i)||"",r=this._getFragments()||[],a=this._findRootAnchor(r),d=a;return this.cancelSelect(),{selectedText:t,anchor:d}}return null},o.prototype.comment=function(){var e=this,n,i;try{if(this.range){var t=this.range,r=t.cloneContents(),a=t.commonAncestorContainer,d=this._createCommentId(r),s=Array.from(r.querySelectorAll("u[data-self]")).map(function(x){return x.getAttribute("data-id")}).filter(function(x){return x&&x!==d});this._wrapCommentRange(a,t,d,{isSelf:!0});var u=document.querySelectorAll('u[data-self][data-id="'.concat(d,'"]')),c=Array.from(u).reduce(function(x,j){return x+e._getText(j)},"");if(!c)return Ae.c.show({content:"\u5F53\u524D\u5212\u7EBF\u65E0\u610F\u4E49\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9",maskStyle:{zIndex:9999}}),this.revertComment({removed:s,id:d}),null;if(c.length>Fn)return Ae.c.show({content:"\u5355\u6B21\u5212\u7EBF\u4E0A\u9650\u4E3A ".concat(Fn," \u5B57"),maskStyle:{zIndex:9999}}),this.revertComment({removed:s,id:d}),null;var m=(n=u.item(0))===null||n===void 0?void 0:n.firstChild,f=u.item(u.length-1);m&&t.setStart(m,0),f&&t.setEnd(f,Xe(f)?((i=f.textContent)===null||i===void 0?void 0:i.length)||0:f.childNodes.length);var v=this._getFragments()||[],A=this._findRootAnchor(v),g=this._getContext(m,f,{anchor:A});this.cancelSelect();var y=this._getFragmentHtml(r);if(c)return{removed:s,comment:{id:d,text:c,anchor:A,contexts:g,fragment:y,fragments:v,status:qe.PROCESSING}}}return null}catch(x){return Ae.c.show({content:"\u5212\u7EBF\u5931\u8D25",maskStyle:{zIndex:9999}}),null}},o.prototype.getCommentIdFromRange=function(){var e=this.range;if(e){var n=null;if(this._isAllTextInSelfComment(e.commonAncestorContainer)?Xe(e.commonAncestorContainer)||this._isSpecialNode(e.commonAncestorContainer)?n=this._findParentCommentNode(e.commonAncestorContainer):n=e.commonAncestorContainer:this._isAllTextInSelfComment(e.cloneContents())&&(n=e.cloneContents()),n){var i=this._collectSelfComment(n);if(i==null?void 0:i.size)return Array.from(i.values())[0].getAttribute("data-id")}}return null},o.prototype.revertComment=function(e){var n=this,i,t,r,a=e.removed,d=e.id;if(d){var s=(i=this.options.comments)===null||i===void 0?void 0:i.find(function(u){return u.id===d});this._removeCommentFromId(d),s&&this.parseComment(s,!0)}(a==null?void 0:a.length)&&((r=(t=this.options.comments)===null||t===void 0?void 0:t.filter(function(u){return a.includes(u.id)}))===null||r===void 0||r.map(function(u){return n.parseComment(u,!0)}))},o.prototype.updateComment=function(e){var n=e.removed,i=e.comment,t=this.options.comments||(this.options.comments=[]),r=i==null?void 0:i.id;if(r){var a=t.find(function(d){return d.id===r});a?Object.assign(a,i):t.push(i)}(n==null?void 0:n.length)&&(this.options.comments=t.filter(function(d){return!n.includes(d.id)})),_.updateComments({results:this.getResults()})},o.prototype.removeComment=function(){var e=this.getCommentIdFromRange();return this._removeCommentFromId(e),this.cancelSelect(),{id:e}},o.prototype.removeCommentFromId=function(e){return C(this,void 0,void 0,function(){return X(this,function(n){return this._removeCommentFromId(e),this.updateComment({removed:[e]}),[2]})})},o.prototype.destroy=function(){var e=this,n,i;document.removeEventListener("selectionchange",this._onSelectionChange),document.removeEventListener("click",this._onCommentTap),document.removeEventListener("touchend",this._togglePopover),document.removeEventListener("mouseup",this._togglePopover),document.removeEventListener("mousedown",this._setMousemovingStatus),document.removeEventListener("mousemove",this._setMousemovingStatus),document.removeEventListener("touchmove",this._hidePopover),_.removeEventListener("goto",this.scrollToComment),_.removeEventListener("removeComment",this.removeCommentFromId),pn(yt,this.debounceResize),(n=this.options.comments)===null||n===void 0||n.forEach(function(t){var r=t.id;e._removeCommentFromId(r)}),(i=this.options.otherComments)===null||i===void 0||i.forEach(function(t){var r=t.id;e._removeCommentFromId(r)}),this.options.shareComment&&this._removeCommentFromId(this.options.shareComment.id),this.worker&&(this.worker.terminate(),this.worker=null),zn&&(zn=null)},o}(),Ei=function(e){return typeof window!="undefined"?(zn||(zn=new ki(e)),zn):null},Si="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAqCAYAAADFw8lbAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAATnSURBVHgBzVlNaBtHFH6z2lVtqQYZ4hxj9ZY4F6Wxj4mlU38uTUJdgmuIc8mhtNSB0ksOxocU+gO1oRR6alpcI0gJurS0J6+TYynxye2tUo5VIIJIcuxdzeS9kWa1+lvNWpKdDyStZmd2vnnvffOeRgyOCLF8JVF2x1JM8PeEYEnBIMWYSICAhOzAoITXebwoARM7AIY9sZm14YhgEBLPl66nJTkGyx4p/dlKTLAciMjG61tbu+GGhiAIQqyiLdMwFDDbtNjN8XvZvFbvfh2ki50oEoQVGAEYsHXHOlibvJcrBfcLwP7y9WTNEdsCRBJGCCSRj1hGJsi6Rq8b5eXFlOvyx6MmSRAAaBC+XV5cTPXq09WiRFK47nZosQwOFJuZ6Sa0DqLH5e4AlEzLuNAeBi2uJ+GcMElCgsLgGXLxN7YQJXWfMEkJilnLeW3V3+a5nlzuOvw/nQcZU1MQXboBxnQSDn74Hmr/7EEYGKemgOEz+o5jRkZlM1O1ua74ETTBi0Vgsbic0Hr73Z4Tsngc2HhMkqJX5EwSIrNzcpyoVqB6+xMQlUrviWSCAVs+i97KiwspwdjjAG6SkHlxrkkCJ1YT8kKhpa/z529gIKnotYWez+NPi3reaFjVbHz5VEZGACJnpiFybqbzOWjZ9nbnoe1di2oVRPF/uRhaVO1JHvjeniSqBV67gu+2tOjzDz94hh+BeyaRkS4kYtPT4LZZwjw7A+6/9TaO98xL89KiZLH9u2swAEqudfiGWS82eN+NnSY0nk7B+N2vgKx/sPmzF1+0CPNWGhdyelBS3ZAwsZzE7YmndUeQiHghX7fqm7Neu3UpLT/JxSMBuh9jlM33i0+CFFI85lnRupz2Njdjph6jFHfm5fkWcTEc0y22PQ5PCsHKB2JnJBnGJ6k9BX0QW/9OqlwHhw/uy88g1StUVz7uKyyqrkj1SdCAVG2x+UAWi8kNv34vL9Xt9cWJ1aKk6quVxpi4HOdv04GgOAXQq5BefPt1y3dy5/id1ca9bzqsEr32vrcIJTAKi7FbH7W0aSJh6vZUWcb7jtbxrmnz9/XV3iNDQJuo9dY7PWNOWVaB4m7IKBkwIiiLD2PLUmLSwuGDX+VLwR+jSrkUHmqrYadO14n6RHZUCDwbCGVRKu9iX3wJY7c/a2mnGKXta2yl2U77J2Eo8YoHGOGIohWpKvILiUBWU8UJWZWgNnlS+OAw7FBEVap0//6r9Qa6221UTCQ6fyaizDMgSlTmaRMltysCtXai0CQfOXfeWxAVMv3SYz/gAUVOzq87IHp1wZucFzvjjjKX88fv4DyyvdxP1wMDz6lAl6iMv9k5b/L2al/s11PiweZPMnXSi0TEQ/6W6jKzrX7jaxElEvt3PpcWcx/uoGvnJVkCEfK71320I9soZrtZPgzcGrvpUcbqqX+N1wbK2ebZ8/JnBRFrj0OK524kqYgxL842FrITPIkQGxNb91cGIjpqUCZyKocXJnPNE76RpdCjQpKsGRk/ScKrRRRPpB1hXp3Mdh4/vjpEkaTLzcxkjyNz7aJklJDudtHd2a18rz4nb1FUtxRONvgsnyxKQXvcB7ZoRmbj29rEL3p/6Zho9w0s+FbhOED/PXGB6SuSC/ufU/1IZ2lhHS9vDPUoHEnhH2UlxmAXOC8QObf8Yrd929HFS0YMRJ6ss/goAAAAAElFTkSuQmCC",_i=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
u[data-id] {
  text-decoration: none;
  border-bottom: 1PX dashed #A88DFB;
}
u[data-self] {
  border-bottom: 1.5PX solid #8C6EEE;
}
figcaption u[data-self] {
  border-bottom-width: 1PX;
}
u.dxy-comment-selection {
  text-decoration: none;
  background-color: rgba(119, 83, 255, 0.1);
  border-bottom-color: transparent;
}
.dxy-comment-disabled {
  -webkit-user-select: none;
     -moz-user-select: none;
          user-select: none;
}
.dxy-comment-special {
  -webkit-user-select: text;
     -moz-user-select: text;
          user-select: text;
}
.dxy-comment-share * {
  font-family: 'Segoe UI Emoji', 'Segoe UI Symbol', 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Noto Color Emoji' !important;
  letter-spacing: 1px;
}
.dxy-comment-share h1, .dxy-comment-share h2, .dxy-comment-share h3, .dxy-comment-share h4, .dxy-comment-share h5, .dxy-comment-share h6 {
  margin-top: 12PX !important;
  margin-bottom: 0 !important;
}
.dxy-comment-share p, .dxy-comment-share div, .dxy-comment-share ul, .dxy-comment-share li, .dxy-comment-share ol, .dxy-comment-share figcaption {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
.dxy-comment-share table {
  border-top: 1px solid #e0e0e0;
  border-left: 1px solid #e0e0e0;
}
.dxy-comment-share table th, .dxy-comment-share table td {
  border-right: 1px solid #e0e0e0;
  border-bottom: 1px solid #e0e0e0;
}
.dxy-comment-share .simplebar-wrapper {
  border-bottom: 1px solid #e0e0e0;
}
.dxy-comment-share .fullscreen {
  position: relative !important;
}
.dxy-comment-share .fullscreen [data-simplebar="init"] {
  max-height: -moz-max-content !important;
  max-height: max-content !important;
}
.dxy-comment-share .fullscreen .simplebar-wrapper {
  height: 100% !important;
  overflow: auto;
}
.dxy-comment-share .fullscreen.horizontal {
  left: 0 !important;
  width: unset !important;
  height: unset !important;
  transform: none !important;
}
.dxy-comment-share .fullscreen figcaption[type="comment"] {
  display: flex !important;
}
.dxy-comment-share figure table {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
.dxy-comment-share .dxy-card {
  padding: 0 !important;
  border: none !important;
}
.dxy-comment-share mark {
  color: inherit !important;
  background-color: transparent !important;
}
.dxy-comment-share figcaption u[data-self] {
  color: #333 !important;
}
img {
  -webkit-user-select: none;
     -moz-user-select: none;
          user-select: none;
}
.ck-content sub, .ck-content sup {
  line-height: inherit;
}
.ck-content sub {
  bottom: -0.25em;
  vertical-align: bottom;
}
.ck-content sup {
  top: -0.4em;
  vertical-align: top;
}
.index-module_container__1xAvw {
  position: absolute;
  z-index: 9998;
}
.index-module_container__1xAvw .index-module_angle__pYVGy {
  width: 44PX;
  height: 6PX;
  margin: 0 auto;
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIQAAAASCAYAAACae3b5AAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAADmSURBVHgB7dm5DcJAEEbhWdEAqeUmkOwCKIF2iICMslyAA7dA4tgNWGafROSIwwf+Z1+0RzhfNsE2XlmW12EYLvYHhRBudV1fbcPtbOO1bVvleR7i8WgrpoCBNg+C1kahgoEkQNBaKJQwkAwIWhqFGgaSAkFLoVDEQHIgaG4UqhhIEgTNhUIZA8mCoKlRqGMgaRA0FQoPGEgeBP2KwgsGcgGCvkXhCQO5AUGfovCGgVyBoHdReMRA7kAQKLIse8ShH+J1P/ru4vs5Yribw4I5ryiK0wuGxTV60/d91TRNZ6lUKpUa9QQZdX3iqFQBpwAAAABJRU5ErkJggg==') center / contain no-repeat;
}
.index-module_container__1xAvw .index-module_angle__pYVGy.index-module_below__bPE8n {
  transform: rotate(180deg);
}
.index-module_container__1xAvw.index-module_tips__GoPK2 {
  z-index: 2;
}
.index-module_container__1xAvw.index-module_tips__GoPK2 .index-module_text__85w9D {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 6PX 12PX;
  font-size: 0.875rem;
  color: #fff;
  list-style: none;
  background-color: #333;
  border-radius: 8PX;
  box-shadow: 0 4PX 10PX 0 rgba(0, 0, 0, 0.1);
}
.index-module_menus__eMkpn {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 12PX 16PX;
  list-style: none;
  background-color: #333;
  border-radius: 8PX;
  box-shadow: 0 0.25rem 0.625rem 0 rgba(0, 0, 0, 0.1);
}
.index-module_menus__eMkpn .index-module_menu__Hp35q {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8PX;
  margin-left: 20PX;
  color: #fff;
  cursor: pointer;
}
.index-module_menus__eMkpn .index-module_menu__Hp35q.index-module_comment__ULkvX {
  position: relative;
  overflow: visible;
}
.index-module_menus__eMkpn .index-module_menu__Hp35q.index-module_comment__ULkvX img {
  position: absolute;
  top: 0;
  left: 100%;
  width: 0.875rem;
  height: 0.875rem;
  transform: translate(-0.6875rem, -1px);
}
.index-module_menus__eMkpn .index-module_menu__Hp35q.index-module_disabled__bSftP {
  opacity: 0.6;
}
.index-module_menus__eMkpn .index-module_menu__Hp35q:first-child {
  margin-left: 0;
}
.index-module_menus__eMkpn .index-module_menu__Hp35q .index-module_icon__WsGMC {
  font-size: 1.5rem;
}
.index-module_menus__eMkpn .index-module_menu__Hp35q .index-module_text__85w9D {
  margin-top: 4PX;
  font-size: 0.625rem;
  line-height: 0.875rem;
  word-break: keep-all;
  word-wrap: nowrap;
}
`,ce={container:"index-module_container__1xAvw",angle:"index-module_angle__pYVGy",below:"index-module_below__bPE8n",tips:"index-module_tips__GoPK2",text:"index-module_text__85w9D",menus:"index-module_menus__eMkpn",menu:"index-module_menu__Hp35q",comment:"index-module_comment__ULkvX",disabled:"index-module_disabled__bSftP",icon:"index-module_icon__WsGMC"};ve(_i);var kt=function(e){var n=e.options,i=e.children,t=e.className,r=n.rects,a=Object(p.useRef)(null),d=Object(p.useState)(null),s=d[0],u=d[1],c=Object(p.useState)(),m=c[0],f=c[1],v=Object(p.useState)(),A=v[0],g=v[1],y=6,x=44;return Object(p.useLayoutEffect)(function(){var j,R;if(a.current){var Z=a.current.getBoundingClientRect(),W=Z.height,K=Z.width,D=document.documentElement.clientHeight,ee=document.documentElement.clientWidth,Y=(j=n==null?void 0:n.scrollTop)!==null&&j!==void 0?j:document.documentElement.scrollTop||document.body.scrollTop,H=(R=Array.from(r))===null||R===void 0?void 0:R.filter(function(G){return G.width&&G.height}),k=H==null?void 0:H[0],b=null,M=null;if(k){if(k.top-W>20)u("above"),b=(k.left+k.right)/2,M=k.top-W-y-12+Y;else{H.reverse();var V=H.find(function(G){return G.bottom+W+y+12<D})||k;u("below"),b=(V.left+V.right)/2,M=V.bottom+12+Y}var F=20,J=ee-K-20,Q=b-K/2;Q<F?(g({marginLeft:Math.max((K-x)/2-(F-Q),0)}),Q=F):Q>J?(g({marginLeft:Math.min((K-x)/2+(Q-J),K-x)}),Q=J):g({marginLeft:"auto"}),f({top:M,left:Q})}}},[r]),l.a.createElement("div",{className:I()(ce.container,"dxy-comment-disabled",t),style:m},s==="below"?l.a.createElement("div",{className:I()(ce.angle,ce.below),style:A}):null,l.a.createElement("div",{ref:a},i),s==="above"?l.a.createElement("div",{className:I()(ce.angle,ce.above),style:A}):null)},Ti=function(e){var n=e.options,i=e.onCommentClick,t=e.onShareClick,r=e.onCopyClick,a=e.onCorrectClick,d=Object(p.useCallback)(function(s){s.stopPropagation()},[]);return l.a.createElement(kt,{options:n},l.a.createElement("ul",{className:ce.menus},r?l.a.createElement("li",{className:ce.menu,onClick:r,onTouchMove:d},l.a.createElement("i",{className:I()("iconfont","icon-dui_copy",ce.icon)}),l.a.createElement("span",{className:ce.text},"\u590D\u5236")):null,i?l.a.createElement("li",{className:I()(ce.menu,ce.comment,!(n==null?void 0:n.isCommentable)&&ce.disabled),onClick:i,onTouchMove:d},l.a.createElement("i",{className:I()("iconfont",n.isSelfComment?"icon-dui_deleteunderline":"icon-dui_underline",ce.icon)}),l.a.createElement("span",{className:ce.text},n.isSelfComment?"\u5220\u9664\u5212\u7EBF":"\u5212\u7EBF"),n.isSelfComment?null:l.a.createElement("img",{"data-preview":"false",src:Si})):null,t?l.a.createElement("li",{className:I()(ce.menu,!(n==null?void 0:n.isCommentable)&&ce.disabled),onClick:t,onTouchMove:d},l.a.createElement("i",{className:I()("iconfont","icon-dui_share",ce.icon)}),l.a.createElement("span",{className:ce.text},"\u5206\u4EAB")):null,a&&!Mn()?l.a.createElement("li",{className:ce.menu,onClick:a,onTouchMove:d},l.a.createElement("i",{className:I()("iconfont","icon-dui_feedback",ce.icon)}),l.a.createElement("span",{className:ce.text},"\u7EA0\u9519")):null))},Ii=function(e){var n=e.options,i=e.onTips;return l.a.createElement(kt,{options:n,className:ce.tips},l.a.createElement("div",{className:ce.text,onClick:i},"\u91CD\u70B9\u5185\u5BB9\u70B9\u51FB\u4E0B\u53EF\u4EE5\u5212\u7EBF\u5566"))},Di=function(e){var n=Object(p.useRef)(null),i=Object(p.useRef)(null),t=e.comments,r=e.otherComments,a=e.shareComment,d=e.userInfo,s=e.shareId,u=e.commentId,c=e.readable,m=e.exclude,f=e.query,v=e.lazy,A=Ge(e,["comments","otherComments","shareComment","userInfo","shareId","commentId","readable","exclude","query","lazy"]),g=Object(p.useState)(null),y=g[0],x=g[1],j=Object(p.useState)(!1),R=j[0],Z=j[1],W=Object(p.useState)(null),K=W[0],D=W[1],ee=Object(p.useContext)(Xt).menus,Y=Object(p.useCallback)(function(k){for(var b=k==null?void 0:k.split("&__&"),M=function(G,oe){var pe=b.slice(0,G).join("&__&"),ye=ee==null?void 0:ee.find(function(ze){return ze.cellId===pe&&!ze.disabled});if(ye)return{value:ye.title}},V=1,F=b==null?void 0:b.length;V<F+1;V++){var J=M(V);if(typeof J=="object")return J.value}return""},[ee]),H=Object(p.useCallback)(function(k){var b=k.removed,M=k.comment;return C(void 0,void 0,void 0,function(){return X(this,function(V){switch(V.label){case 0:return Ci({data:{pageName:"app_p_detail",logType:"app_e",event_id:"app_e_click_draw_line",object_id:"".concat(A.fieldId),object_name:A.fieldName,ext:{type:"".concat(A.moduleType)}}}),[4,_.saveComments(h(h({},A),{comment:M,removed:b})).then(function(F){var J,Q,G=F.code,oe=F.message;G==="success"?(J=n.current)===null||J===void 0||J.updateComment({comment:M,removed:b}):(Ae.c.show({content:oe||"\u5212\u7EBF\u5931\u8D25",maskStyle:{zIndex:9999}}),(Q=n.current)===null||Q===void 0||Q.revertComment({removed:b,id:M==null?void 0:M.id}))})];case 1:return V.sent(),[2]}})})},[A]);return Object(p.useEffect)(function(){i.current=ee},[ee]),Object(p.useEffect)(function(){_.getCacheTypeValue(Xn.COMMENT_TIPS).then(function(k){Z(!k)})},[]),Object(p.useEffect)(function(){return n.current=Ei({onPopover:function(b){A.moduleType===ae.GUIDE&&!c||x(b)},onTips:function(b){A.moduleType===ae.GUIDE&&!c||(D(b),b||Z(function(M){return M&&_.setCacheTypeValue({key:Xn.COMMENT_TIPS,value:!0}),!1}))},onShare:function(b){return C(void 0,void 0,void 0,function(){return X(this,function(M){return[2,_.saveComments(h(h({},b),A)).then(function(V){return(V==null?void 0:V.code)==="success"})]})})},onImageGenerating:function(){Ae.c.show({icon:"loading",duration:0,maskStyle:{zIndex:9999}})},sortAnchor:function(b,M){var V;if((V=i.current)===null||V===void 0?void 0:V.length){var F=fn(i.current,b).cellIndex,J=fn(i.current,M).cellIndex;return F>-1&&J>-1?F-J:F>-1?-1:J>-1?1:0}return null},infoId:A.fieldId,moduleType:A.moduleType,readable:c,commentId:u,comments:t,otherComments:r,shareComment:a,query:f,lazy:v}),function(){var k;(k=n.current)===null||k===void 0||k.destroy()}},[t,r,a,u,f,v,c,A.moduleType,A.fieldId]),[Be.COMMENT,Be.COPY,Be.FEEDBACK,Be.SHARE].every(function(k){return m==null?void 0:m.includes(k)})?null:y?l.a.createElement(l.a.Fragment,null,Object(Ze.createPortal)(l.a.createElement(Ti,{options:y,onCommentClick:(m==null?void 0:m.includes(Be.COMMENT))?void 0:function(k){if(k.stopPropagation(),k.preventDefault(),!(d==null?void 0:d.userName))_.redirectLogin({reload:!0});else if(n.current)if(y.isSelfComment){var b=n.current.removeComment(),M=b==null?void 0:b.id;M&&(Xi({data:{pageName:"app_p_detail",logType:"app_e",event_id:"app_e_click_delete_line",object_id:"".concat(A.fieldId),object_name:A.fieldName,ext:{type:"".concat(A.moduleType)}}}),_.saveComments(h(h({},A),{removed:[M]})).then(function(V){var F,J,Q=V.code,G=V.message;Q==="success"?(F=n.current)===null||F===void 0||F.updateComment({removed:[M]}):(Ae.c.show({content:G||"\u5220\u9664\u5212\u7EBF\u5931\u8D25",maskStyle:{zIndex:9999}}),(J=n.current)===null||J===void 0||J.revertComment({removed:[M]}))}))}else{var b=n.current.comment();b?H(b):n.current.selectRange()}},onShareClick:(m==null?void 0:m.includes(Be.SHARE))?void 0:function(k){return C(void 0,void 0,void 0,function(){var b,M,V;return X(this,function(F){switch(F.label){case 0:return k.stopPropagation(),k.preventDefault(),(d==null?void 0:d.userName)?[3,1]:(_.redirectLogin({reload:!0}),[3,4]);case 1:return n.current?(x(null),[4,n.current.getShareSelection().catch(function(){})]):[3,4];case 2:return b=F.sent(),b?[4,_.getMobileOrigin()]:[2];case 3:if(M=F.sent(),V="",s)switch(A.moduleType){case ae.EVIDENCE:V="".concat(M,"/pc/evidence/").concat(s,"?commentId=").concat(b.id,"#").concat(encodeURIComponent(b.anchor));break;case ae.DRUG:V="".concat(M,"/pc/drug/").concat(s,"?commentId=").concat(b.id,"#").concat(encodeURIComponent(b.anchor));break;case ae.CLINICAL:V="".concat(M,"/pc/clinicalDecision/").concat(s,"?commentId=").concat(b.id,"#").concat(encodeURIComponent(b.anchor));break;case ae.GUIDE:V="".concat(M,"/pc/clinicalGuidelines/").concat(s,"?commentId=").concat(b.id);break}Pi({data:{pageName:"app_p_detail",logType:"app_e",event_id:"app_e_click_share_card",object_id:"".concat(A.fieldId),object_name:A.fieldName,ext:{type:"".concat(A.moduleType)}}}),Ae.c.clear(),_.redirectSelectText(h(h(h({},A),b),{type:2,qrcodeLink:V,anchor:Y(b.anchor)})).then(function(J){var Q,G=b.comment,oe=b.removed;(G||oe)&&((J==null?void 0:J.needComment)?H({comment:G,removed:oe}):(Q=n.current)===null||Q===void 0||Q.revertComment({removed:oe,id:G==null?void 0:G.id}))}),F.label=4;case 4:return[2]}})})},onCopyClick:(m==null?void 0:m.includes(Be.COPY))?void 0:function(k){if(k.stopPropagation(),k.preventDefault(),n.current){var b=n.current.getPlainSelection(!0);(b==null?void 0:b.selectedText)&&(zi({data:{pageName:"app_p_detail",logType:"app_e",event_id:"app_e_click_copy",object_id:"".concat(A.fieldId),object_name:A.fieldName,ext:{type:"".concat(A.moduleType)}}}),_.redirectSelectText(h(h(h({},A),b),{type:3,anchor:Y(b.anchor)})))}},onCorrectClick:(m==null?void 0:m.includes(Be.FEEDBACK))?void 0:function(k){if(k.stopPropagation(),k.preventDefault(),n.current){var b=n.current.getPlainSelection();(b==null?void 0:b.selectedText)&&_.redirectSelectText(h(h(h({},A),b),{type:4,anchor:Y(b.anchor)}))}}}),document.body)):R&&K?l.a.createElement(l.a.Fragment,null,Object(Ze.createPortal)(l.a.createElement(Ii,{options:K,onTips:function(){Z(function(b){return b&&_.setCacheTypeValue({key:Xn.COMMENT_TIPS,value:!0}),!1})}}),document.body)):null},Li=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_simple-module__mbdI5 .ck-content p,.index-module_simple-module__mbdI5 .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__mbdI5 [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__mbdI5 [data-menu-index='1'] h1,.index-module_simple-module__mbdI5 [data-menu-index='1'] h2,.index-module_simple-module__mbdI5 [data-menu-index='1'] h3,.index-module_simple-module__mbdI5 [data-menu-index='1'] h4,.index-module_simple-module__mbdI5 [data-menu-index='1'] h5,.index-module_simple-module__mbdI5 [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__mbdI5 [data-menu-index='4'] {
  margin-top: 8px;
}
.index-module_disease-time__VEFNz {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 20px 0;
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: #999;
  font-weight: 400;
}
.index-module_disease-time__VEFNz .index-module_time-container__N1Tf8 {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-start;
}
.index-module_disease-time__VEFNz .index-module_point__iCHbC {
  padding: 0 4px;
}
.index-module_disease-time__VEFNz .index-module_iconarrow_right_small_ok__Txj7I {
  flex: none;
  margin-left: 4px;
  font-size: 0.5rem;
  color: #cccccc;
}
`,An={"simple-module":"index-module_simple-module__mbdI5","disease-time":"index-module_disease-time__VEFNz","time-container":"index-module_time-container__N1Tf8",point:"index-module_point__iCHbC",iconarrow_right_small_ok:"index-module_iconarrow_right_small_ok__Txj7I"};ve(Li);var Wi=Object(p.memo)(function(o){var e=o.lastLiteratureDate,n=o.lastModifyTime,i=o.hasUpdateRecord;return e||n?l.a.createElement("div",{className:I()(An["disease-time"],"dxy-comment-disabled"),onClick:function(){i&&_.redirectUpdateRecord(1)}},e||n?l.a.createElement("div",{className:An["time-container"]},e?l.a.createElement("span",{className:An["literature-time"]},"\u6587\u732E\u8BC4\u5BA1 ",e):null,e&&n?l.a.createElement("span",{className:An.point},"\xB7"):null,n?l.a.createElement("span",{className:An["modify-time"]},"\u6700\u65B0\u4FEE\u8BA2 ",n):null):null,i?l.a.createElement("i",{className:I()("iconfont","icon-arrow_right_small_ok",An.iconarrow_right_small_ok)}):null):null}),Et=Object(p.createContext)({}),Hi=function(){function o(){this.counter=[{type:"s1",value:0},{type:"s2",value:0},{type:"o1",value:0},{type:"o2",value:0},{type:"o3",value:0},{type:"o4",value:0},{type:"o5",value:0},{type:"o6",value:0}]}return o.prototype.transformCounter=function(e,n){switch(e){case"s1":return"".concat(Rn(n),"\u3001");case"s2":return"(".concat(Rn(n),") ");case"o1":return"".concat(n,"\u3001");case"o2":return"(".concat(n,") ");case"o3":return"".concat(n,") ");case"o4":return"".concat(n);case"o5":return"".concat(Kt(n),". ");case"o6":return"".concat(Yt(n),". ");default:return"".concat(n)}},o.prototype.parse=function(e){var n,i,t,r,a,d;if(e.type==="tag"){var s=null,u=(n=e.children)===null||n===void 0?void 0:n[0];if((i=e.attribs)===null||i===void 0?void 0:i["data-section-index"]){var c=(t=e.attribs)===null||t===void 0?void 0:t["data-section-index"];s="s".concat(c)}else((r=e.attribs)===null||r===void 0?void 0:r["data-orderedlist-index"])&&(s="o".concat((a=e.attribs)===null||a===void 0?void 0:a["data-orderedlist-index"]));if(s){var m={type:"tag",name:"span",attribs:{class:I()("dxy-ordered-node","dxy-comment-disabled","dxy-comment-special")},children:[{type:"text",data:this.increment(s)}],parent:e,next:u};(d=e.children)===null||d===void 0||d.unshift(m),u&&(u.prev=m)}}},o.prototype.increment=function(e){var n=this.counter.find(function(i){return i.type===e});return this.reset(e),n?(n.value+=1,this.transformCounter(e,n.value)):this.transformCounter(e,1)},o.prototype.reset=function(e){var n=this.counter.findIndex(function(t){return t.type===e});if(n>-1)for(var i=n+1;i<this.counter.length;i++)this.counter[i].value=0},o.prototype.resetAll=function(){this.counter.forEach(function(e){e.value=0})},o}(),Mi="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAACXBIWXMAAG66AABuugHW3rEXAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAkYSURBVHgB7Z3BbhtHEoarhrJMGViEe9sVd2H6CSIfYjF7CX3bwwKRn8DyJQs5B8tPYOkJJB3WtPdi7RMoOuxZzCVxkoOZJ8gEiJIcGQSwadLTlaoRZZASOd0908MZCv0BBK1hk57hP9VdXVXdBPB4PB6Px+PxeDwej8fj8XgWA4QrTKvxovZ2MGgpjBoIwYcE1ADCGgDxA3uA1OO/+RlCAPVjBZY6X51+1oUCuXKCiAivB/1HiNAC4oclxCIhBR1EOn55unUIc+bKCNL8W7tFBE/SiJBAyN9QB6/B7stwK4Q5sPCC5CTEJQhg58Zy9aATPuhBjiysINI1vRm+ZSFoG+ZHyF3hbp5dWQUWkGaj3RgO3n3N//wnzBd2BmCj/qd/wenv//8ScmDhLES6KEV0hLG3VCTYXVm+ftd1F7ZQgjTrz+8TqUMoDyEuw12XA/7CCJJZDMQuX6w8fiOi3tkhrPFg/SH/3eA/G5COcGW5etuVpSzBApBGjPfziYAOqkvVru4La/6l3eAR9cxjsxOn8WbYP+Lnu+CA0luIrRgiREB4UF2u7qe9a2NXWsELsBBGIe1/d/rwMWSk1ILYisFdUAcievDyVzd9+sf159sRRE9MHQgMeDz5aasDGSitINbdFMLBN6dbzuck0pVRACdgZi2Zx5MASoh1NwVqNw8xBLE2VPH4EBo0b7wevM50HqWzkDRifPvz5zuQM+aWgj2en9xKayWlspCyiiGcW4o4DcktqZbFSkpjIR/V/7MWUPDKtP08xRhHBnpFai+5VXorKYWFSGyKxTgybV+UGMLXp//ej725RKjWf9dfgxSUQhAamk/GihTjPUi72jYK70MKChdErIO/5U2TtqUQg5G5hs5KOCSzASkoXJCRdejblUSMc/h8jjUtav+o/9e62ypUEFPrKJsYAkb4ha6NgmixBIGhPu2KgIdlE0MQN1jnAnO3ZS1IodFeQvyUU7DJjVTyAHqWU6f4wuddxoMYdPj8Z48VZB/SL9ZCFOnuoOOkQOH6avsFR2VPWNk9eUQUvfqo/lQzR3AHKvotuQF8AJYUJshaY08iqI3ERkSdWS81V5+LM7B58TiH3rfX6+0XMB/CxFcXyUKq/ao2pI0VnNn9KIxmhyfYUZijKE4pZbT3Pe+m34ES6NPmKOYgCiEknwMaRYgnKLUgQaUy9YL71b5ZjChvURBvgmNy8bLOitjebJ4VOKvv8Rp+kaYyY+THX+q2uuHjXrP+rMPeVUv7IWeiAOdLHoBrNGMEW3EIlji3EAmhvx6++UG8Hv7CNuPnAb6S4+PtMvvxnKoFMOwScrCU2CkhnZdIP4IlTgU5z2dc7t+pxuLsxzPzif88SJ4zEN4Xa5v2kmUmz7koy9H1lrZRAB2wxJkgH68+30hOLlFNDdTm5CHSlGMmJ3uKFAUVT2o1SPkRWOJEELnzI4y0FxpA5eaFAx3dexAqj5KCdEWIYhSDQ+gUkqCSLoUGcGJSKsNjxsTM1iSMLVbCM/Cji93dxOfMWRSjCLWiY0hBZkHiJQGGySWMYP/yUfof6GmI6GUQxTRCzTeoNho8jUyCnJ2c2foMCaFPi0vFay0QTfraUogi52DQ7DhtsV42Cxmi0cXo8hmIZFqCmYsod1bbRkmyUfysoWuHwbSewIzUgozC3i1dO5PkUjyWAOjz1Gc4F4X/7x25nqQ2IgZfyw7oP6yTpZw0vYUQmtxVoWly6eXPWzs86JuMJ4JzUUjhzLC9sRgQj5OZIgKpBJEvwsQ6Rl+IMd+ePtwsThRaa9bbmxePxtdqKMascdKGVILQkLQVFZJ6TXNyRYrCoZpLpTvs4ppWIYYuUs0pu6xAX3OkyHRMuEQeoihU97RloASti2MJEpjMr3q2vcEsrAUxCaqltY5xXIvy3ennXVnIAxqUUq0Lh0LdewLEe67WpFgLUn1X1VZSKG3NkhmuRekv9/d1VoIYfDJxQMFh0nsQ4UHWRTrj2HdZSl+6c2N5pQOOcCmK5FHYepM/i3DihpM7PwB8fFGUuJsSMRxvIpBmDGkkvUhAXddrt61FGcLMCStOSXhNQrV4AegY8qUHEd7mAeUxx94O5fnGtZVbeezoYJ8xlLRlQi0V34HWSRkTRJQ79acSI9I7FDw4S9Bz2o0RXKt0o0EEtozGiNQzcFPc59RTJPZNsbGUfr8/1TtS/cip9brGWpDRIvuZsJuY6wWbiYK9mV7Pkn2t1DwpdxnQDHSiEEQz3VvS5sHZk6xWC7Mia0F4UAs1LZyXxkxDRJGl0Jde4GOJkWUIdKnXMO89sZKw77IQNJUi9GeYE7IUmmfIt8TriT2gAO4mLY82jMF9DwVi72WRrrQFP4E5YuP9qAHtoWadK88tUmX6XGHfZaXw48uAhNBZDG1QFCL70h2XWAsifryuDQ+4+gufI6b5DBcxuKxYC/JV+FlXGzUN9DVL88ImuZQlQu2KVG4vR02Tg4dTwthFYJXpK4F1COnmIQEc6pqMNgIrDCvLkBB7CaxDSCVIf6nfNUn2rP/1qWm2zSmWYoAkr8pgHUIqQSSMbZLsAQyeJOUn8sBWDAmhS/IKSkLq0IlJsieuetckjVySRowi9ndPIrUgxlZikMlzwVUQQ8gUXBQrAcOd1vIUZb3+bO8qiCEgZGS0g6dJvSvEv9lBavebXx46SfTEsakBHklNlel7yiyGkFkQYb3e3mev6pHFW0IOBKYuDnj/GyEAOzbvK7sYghNBhGb92YnRIsxJQo7SHphsiSEiyKZgpJCFtw/NLIIYgjNBpF7r+nDlBMi8+xgnruIA2Q6c8y2jiDIhfsAnWONJ5ppNt3SRRRFDcCaIYLnH7VxYJDEEpylcme2+Xe7f1i9Ty5/Y4mSn6QUSQ3BqIeM0V9s7BIXFs+IC67KEQ2zIrcghXu9RoXsA+ZUFTYVz6rLd9yKKIeRmIefIYF8dVLfztpa4m0TadVlnWwS5C3JOPOBXYJvnK5K8aoAjrooQ58xNkHHu/P3pRhDhhkL6NM1vScUiEH2Z5TdCykohgowjW4xXIFjj+ceaIrjJbqr8DJGsQalJDRjPQaTKvBfvKoTYNfm1HI/H4/F4PB6Px+PxeDwej8eTP38A60UVa7zszL4AAAAASUVORK5CYII=",Ri="data:image/png;base64,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",Zi=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_simple-module__sXCzd .ck-content p,.index-module_simple-module__sXCzd .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__sXCzd [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__sXCzd [data-menu-index='1'] h1,.index-module_simple-module__sXCzd [data-menu-index='1'] h2,.index-module_simple-module__sXCzd [data-menu-index='1'] h3,.index-module_simple-module__sXCzd [data-menu-index='1'] h4,.index-module_simple-module__sXCzd [data-menu-index='1'] h5,.index-module_simple-module__sXCzd [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__sXCzd [data-menu-index='4'] {
  margin-top: 8px;
}
.index-module_icon__JpYzR {
  -webkit-user-select: text !important;
     -moz-user-select: text !important;
          user-select: text !important;
}
.index-module_img__wTdvI {
  display: inline !important;
  width: 1em !important;
  min-width: 1em !important;
  max-width: 1em !important;
  -webkit-user-select: text !important;
     -moz-user-select: text !important;
          user-select: text !important;
  border: none !important;
}
`,St={"simple-module":"index-module_simple-module__sXCzd",icon:"index-module_icon__JpYzR",img:"index-module_img__wTdvI"};ve(Zi);var Un=function(e){var n,i=e.counter,t=Ge(e,["counter"]),r=Object(p.useContext)(Et),a=Object(p.useRef)(!1),d=Object(p.useRef)(new Hi),s=Object(p.useMemo)(function(){return vn()},[]),u=t.CustomLink||r.CustomLink,c=r.detail,m=(n=r.appendLinkIcon)!==null&&n!==void 0?n:!0;return Object(p.useEffect)(function(){var f;d.current&&((f=d.current)===null||f===void 0||f.resetAll())},[t]),Object(p.useLayoutEffect)(function(){a.current=!0},[]),l.a.createElement(Qe.b,h({},t,{CustomLink:u,tableWrapperProps:h(h({},t==null?void 0:t.tableWrapperProps),{allowRotate:!0,allowGesture:!0,isMobile:!0,onRotate:function(v){(c==null?void 0:c.id)&&_.daTrackEvent({pageName:"app_p_detail",eventId:"app_e_click_table_hzscreen",objectId:"".concat(c.id),objectName:c.name,userInfo:{type:c.moduleType,isHorizontal:v}})},exitFullscreen:function(){a.current&&(si(),_.setVisibility({visible:!0,animated:!0,views:["bottomToolbar","menu","navigationToolbar","adBubble"],hasFullscreenView:!1}))},requestFullscreen:function(){a.current&&(_.setVisibility({visible:!1,animated:!0,views:["bottomToolbar","menu","navigationToolbar","adBubble"],hasFullscreenView:!0}),ui(),(c==null?void 0:c.id)&&_.daTrackEvent({pageName:"app_p_detail",eventId:"app_e_click_table_fullscreen",objectId:"".concat(c.id),objectName:c.name,userInfo:{type:c.moduleType}}))},gestureCallback:function(){(c==null?void 0:c.id)&&_.daTrackEvent({pageName:"app_p_detail",eventId:"app_e_click_table_scale",objectId:"".concat(c.id),objectName:c.name,userInfo:{type:c.moduleType}})},expandCallback:function(){(c==null?void 0:c.id)&&_.daTrackEvent({pageName:"app_p_detail",eventId:"app_e_click_table_upfold",objectId:"".concat(c.id),objectName:c.name,userInfo:{type:c.moduleType}})}}),autoTableSize:h(h({},fi()),{version:2,unit:"em"}),preTransform:function(v,A){var g,y,x,j,R,Z,W,K;if(i&&((g=d==null?void 0:d.current)===null||g===void 0||g.parse(v)),v.type==="tag"&&v.name==="sup"){var D=(y=v.children)===null||y===void 0?void 0:y[0];if((D==null?void 0:D.type)==="tag"&&(D==null?void 0:D.name)==="img"&&((j=(x=D.attribs)===null||x===void 0?void 0:x.src)===null||j===void 0?void 0:j.indexOf("node/"))===0)return l.a.createElement(l.a.Fragment,null)}var ee=(R=t==null?void 0:t.preTransform)===null||R===void 0?void 0:R.call(t,v,A);if(ee===null||l.a.isValidElement(ee))return ee;if(Object(Qe.c)(v)&&(gt(v)&&m&&!s||Ft(v))){var Y=(Z=v.children)===null||Z===void 0?void 0:Z[((W=v.children)===null||W===void 0?void 0:W.length)-1];if(Y){var H={type:"tag",name:"sup",attribs:{class:I()("dxy-comment-disabled",St.icon)},prev:Y,children:[{type:"tag",name:"img",attribs:{src:gt(v)?Mi:Ri,class:I()(St.img),"data-preview":"false","data-icon":"true"}}]};Y&&(Y.next=H),(K=v.children)===null||K===void 0||K.push(H)}}}}))},Vi=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_text-folded__d-aG9 {
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: initial;
  /*! autoprefixer: off */
  -webkit-box-orient: vertical;
}
.index-module_text-folded__d-aG9.index-module_expand__RnAZV {
  position: relative;
}
.index-module_text-folded__d-aG9.index-module_expand__RnAZV::after {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 1;
  padding-left: 8px;
  font-size: inherit;
  line-height: inherit;
  color: #7753ff;
  content: '...\u5C55\u5F00';
  background-color: #fff;
}
`,hn={"text-folded":"index-module_text-folded__d-aG9",expand:"index-module_expand__RnAZV"};ve(Vi);var Gi=function(e,n){var i=Object(p.useState)(),t=i[0],r=i[1];return Object(p.useEffect)(function(){var a=document.createElement("div");return Tn.a.render(l.a.createElement(l.a.Fragment,null,e),a,function(){var d=function(g){switch(g.nodeType){case Node.TEXT_NODE:return g.nodeValue||"";case Node.ELEMENT_NODE:return g.nodeName==="TABLE"?"[\u8868\u683C]":g.nodeName==="IMG"?"[\u56FE\u7247]":g.childNodes?Array.from(g.childNodes).reduce(function(y,x){return y+d(x)},""):"";default:return""}},s=d(a);if(l.a.Children.count(e)===1){var u=l.a.Children.only(e);if(l.a.isValidElement(u)){var c=u.props;c.dangerouslySetInnerHTML;var m=Ge(c,["dangerouslySetInnerHTML"]),f=Un===u.type?"div":u.type,v=l.a.createElement(f,h(h({},m),{className:I()(m.className,hn["text-folded"]),style:h(h({},m==null?void 0:m.style),{WebkitLineClamp:n})}),[s]);r(v)}}}),function(){Tn.a.unmountComponentAtNode(a)}},[e,n]),t},Bi=function(e,n){var i=Object(p.useRef)(null),t=Object(p.useState)(!0),r=t[0],a=t[1],d=e.mode,s=d===void 0?"rich":d,u=e.children,c=e.lines,m=c===void 0?0:c,f=e.canFolded,v=f===void 0?!1:f,A=e.canClick,g=A===void 0?!0:A,y=e.onClick,x=e.onChange,j=e.force,R=Gi(u,m),Z=Object(p.useMemo)(function(){return s==="rich"?u:R},[R,u,s]);Object(p.useLayoutEffect)(function(){var K;if(m){var D=i.current,ee=(K=D==null?void 0:D.firstElementChild)!==null&&K!==void 0?K:D;if(zt(ee)&&zt(D)){var Y=new qn.a(function(){window.requestAnimationFrame(function(){if(r){var H=window.getComputedStyle(D).height,k=window.getComputedStyle(ee),b=k.lineHeight,M=k.marginTop,V=k.marginBottom,F=k.paddingTop,J=k.paddingBottom,Q=Math.ceil(+H.replace(/px/,"")/+b.replace(/px/,""));(Q>m||j)&&(D.classList.add(hn["text-folded"]),(g||y)&&D.classList.add(hn.expand),D.style.webkitLineClamp="".concat(m),D.style.lineHeight=b,D.style.height="".concat(m*Pn(b)+Pn(M)+Pn(V)+Pn(F)+Pn(J),"px"),D.querySelectorAll(".new-line").forEach(function(oe){oe.style.margin="".concat(+b.replace(/px/,"")/2,"px 0")}),x==null||x(!0))}else{var G=D.classList.contains(hn["text-folded"]);G&&(D.classList.remove(hn["text-folded"]),(g||y)&&D.classList.remove(hn.expand),D.style.webkitLineClamp="0",D.style.height="auto",D.style.lineHeight="auto",x==null||x(!1))}})});return Y.observe(ee),function(){return Y.disconnect()}}}},[r,s,Z,j]);var W=Object(p.useCallback)(function(){a(function(K){return v?!K:!1})},[v]);return Object(p.useImperativeHandle)(n,function(){return{change:W,isFolded:r}},[W,r]),l.a.createElement("div",{ref:i,onClick:function(){y&&y(r),g&&W()}},Z)},Fi=Object(p.forwardRef)(Bi),Ui=`.index-module_simple-module__qSmuF .ck-content p,.index-module_simple-module__qSmuF .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__qSmuF [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__qSmuF [data-menu-index='1'] h1,.index-module_simple-module__qSmuF [data-menu-index='1'] h2,.index-module_simple-module__qSmuF [data-menu-index='1'] h3,.index-module_simple-module__qSmuF [data-menu-index='1'] h4,.index-module_simple-module__qSmuF [data-menu-index='1'] h5,.index-module_simple-module__qSmuF [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__qSmuF [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_thanks__EGPOx {
  padding: 12px;
  background-color: #f5f6f9;
  border-radius: 0.75rem;
  margin: 32px 20px;
}
.index-module_thanks__EGPOx .index-module_header__Zukyh {
  display: flex;
  align-items: flex-end;
  justify-content: flex-start;
}
.index-module_thanks__EGPOx .index-module_header__Zukyh .index-module_title__fS4bY {
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.375rem;
}
.index-module_thanks__EGPOx .index-module_header__Zukyh .index-module_info__dZn89 {
  font-size: 0.6875rem;
  line-height: 1.0625rem;
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 {
  margin-top: 8px;
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 .index-module_content__JmfFL {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #666;
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 .index-module_footer__HRtjQ {
  display: flex;
  justify-content: center;
  padding-top: 12px;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #7753ff;
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 .index-module_footer__HRtjQ .index-module_icon__ou-dG {
  margin-left: 4px;
  font-size: 0.75rem;
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 .index-module_footer__HRtjQ .index-module_icon__ou-dG.index-module_folded__-X2eG {
  transform: rotate(90deg);
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 .index-module_footer__HRtjQ .index-module_icon__ou-dG.index-module_expanded__wk2vc {
  transform: rotate(-90deg);
}
.index-module_thanks__EGPOx .index-module_container__JJJ34 .text-folded::after {
  content: none;
}
`,He={"simple-module":"index-module_simple-module__qSmuF",thanks:"index-module_thanks__EGPOx",header:"index-module_header__Zukyh",title:"index-module_title__fS4bY",info:"index-module_info__dZn89",container:"index-module_container__JJJ34",content:"index-module_content__JmfFL",footer:"index-module_footer__HRtjQ",icon:"index-module_icon__ou-dG",folded:"index-module_folded__-X2eG",expanded:"index-module_expanded__wk2vc"};ve(Ui);var Ki=function(e){var n=e.content,i=Object(p.useRef)(null),t=Object(p.useState)(null),r=t[0],a=t[1],d=function(){i.current&&i.current.change()},s=Object(p.useMemo)(function(){return Array.isArray(n)&&n.length?n.map(function(u){var c=u.authorName,m=u.hospital;return[c,m&&"\uFF08".concat(m,"\uFF09")].filter(Boolean).join(" ")}).join("\u3001"):""},[n]);return s?l.a.createElement("div",{className:I()(He.thanks,"dxy-comment-disabled")},l.a.createElement("div",{className:He.header},l.a.createElement("span",{className:He.title},"\u611F\u8C22\u4EE5\u4E0B\u533B\u7597\u4ECE\u4E1A\u8005\u53C2\u4E0E\u8D21\u732E"),l.a.createElement("span",{className:He.info},"\uFF08\u6392\u5E8F\u4E0D\u5206\u5148\u540E\uFF09")),l.a.createElement("div",{className:He.container},l.a.createElement(Fi,{ref:i,lines:3,canFolded:!0,canClick:!1,onChange:a},l.a.createElement("div",{className:He.content},s)),r!==null?l.a.createElement("div",{className:He.footer,onClick:d},l.a.createElement("span",{className:He.text},r?"\u5C55\u5F00":"\u6536\u8D77"),l.a.createElement("i",{className:I()("iconfont icon-arrow_right",He.icon,r?He.folded:He.expanded)})):null)):null},Yi=`.index-module_disease-brand__Qqq-x {
  display: block;
  width: 9.9375rem;
  height: 1rem;
  margin: 16px 20px 0;
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAd0AAAAwCAYAAABUkKCGAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAADeZSURBVHgB7X0JmF5VmeZ3bipLZSOpLFXZi2xIhIQAzaosQUdHooIC8tit6OiIztjDgPM8Pe3yANPKtN0zijN2D6gzLI5iCyq2AYFWwr7IFhIgQPZUlkollVSWqkpSlTp93nPOd85377/XlkD+Dyr//9//3nPPPff+33vebzuKikjjHXeM6xk5+jql6SJSupE0NSqVaCKtFHbAv1rbV/9Zm89mF7z6TXYz/tX+E//rRdnv/f7a7xt3xnfKnSe0x+f1+9pX2ynzv9mqE3JtkW8rHI+2CP/p2AXus4p903Y/1zXeJ+cYIziPlteD/UxbON5+Z/fTFM5pvyfFx8fD3PgoHa6ZfP91HKI41jwEfpSw0fXFvredcruT77e7njB+vN32isQ4hnM7cWPqz+j+ie0o2mO686pp4/6a7p7f3n/xxRspI8v37BlXU9NzXQ/pi0xL5tkxz1BVqlKVqrz7pM3oyxWJ0Yfd3clvLx4/fmOhHVW+jQ333NM4XCV3mK8vCoAajvAgxe+JQSE2J7Q7qQzCSgUuwDsFCv483ASjgwA/B08MjNqDQRrgua9pMFepUwgcTZ089JS7kt4v02c5DgyyYgjceTyQ+y6IYykAsYqTBS2BVqt4fRqTjcTDeJh4aN+NRLvJRWxcDgclblIQwT/cT8qOSwD5cGGFxiOc4M4hXfpmgK8B28ak5sgd5puLqCpVqUpVjjdRdOeRriE35wPfHNBt/OV91+kefZN5O47pGTnsC0CoPGIy4gXAYADxLTOrStIaW+6TBkH3fVD2KsPqAkiqePp4rIpgbvullWwjvLdsMQMi4o3Hd83MMfGI6gGTspMQJVl3ZKO5IKyygy2uLfZfi005ExDx0eGctyj4CYOWoxDBPDJY7dFRTnCY1UdLALNkORnQYcQcRfZzAx6uaClomz6y9v6r586+jPD8VKUqVanK8Sttuqfn5gtPmHyr3JjCgZn/dO+NRtHelLFkEptNVZby6RzQICJhik2Bj1D+wjRMJIAxZar2tmI+v2iHgcAbbYXJMw3YwTwa3xMT59TFR0gR/fJM3PHnwMp15vqUGCbJxAX4xfFxmKpJ8fzEgTopAYYZS0IKq4WZm6/dTgrkeArmHCwJHtBVtDdTrpUhTC0090OlcT/2QQtgFvt0dndRR3c3fWDaVLrE/FWlKlWpyvEuRpne9P4xE26On700/vKX12mdfJ90j9e58UtW6EFhC1YU/ZiOHUaTbkRaCWj5wJypG5tH7deOxREJcE1yyKLSKTbIpuTEtuOvNwK0E3QgiWZWAeSOsYn38nTWt+wZtBIQmu5LOIkDevbnUnSf8sCkrp2iczjVTjQ1xwmOEuZ2ihMfC7LK9S8RwJ3bN8H4VQrseUxSE5MwHjzE5CdgiW/Mfe48coTauw6H4Vo6cwad31BPValKVapyvIthvNcz47WatfGe3zRq1f2KUarBJCgMldGsKAN9pGnYA0AugwyBRCrt2yUJdmkk5SAkygKajizQs88Uo5bBUCmqrqPpVnNHNAm/Zv7rCM5jDiYSg1FoTCg90eDgLp7ExLGlMPNQqUtPjwVT1fC/O8Cbgyntuw3nFWcRgVUC0OPZJatOpNnfja0WgO7M9XHyFOYRlmhrtefQQWvBYBkxZAj9p1MW0Pjhw6kqValKVY5zaTvSPWQxfLyOrqgjNwbAVdZ4yMqeggnSs7QkYb+uYg+hdmDBep3bcO8TpYIp0jWlwp8ECcXfBfOplHRwkvsTJBfcNTAvFxhEHpkcOBPFKYF7xyZSCU2Iuo6Ay1jkL0CRDN6K7fC1yLEKffYTAccotUr1ITupcAdJ4PJgr/x42iFMKIJ86nxyNPheuHsW+uCjupUcwxDkpeNcgP3hifjOXaeYXCjH29FmhzEry35DDhrme9/6jVSVqlSlKlWhcQguxRsFlktDjqyP5lRvBpb+QrunMDtGy6lRutGvGiNq7QFMNCO4ui9SDDKaOHV4z+k2bC4mf36VYndEKnXuKCnTbvwmnicQurg/m2ml+Vt5JijZuExPimxWzBGkn1el+sRtuWtUYmy5Xc+cA8j3CD+6azDF7hO2+1IOgIeRl+3zzciOFR8nfMmkhPE8FREuj4HVxPRnd2cnFZIbT19MI2qGUFWqUpWqHO9i2O54o7e7L4vK1kemEjNZEZVrXxIGUAsGSfRHel4Z9meHYkAV7dleEpOLInvyAOY4NjmzptbBiAlfryLeVwj3hT+ilST4KVlEABUpngy4D0p0LwKuitcfATcNoB79o187WAdUGsxVPFT5z/6SBbXkPmtxLaFd8hMemVblxoqd5yocEfN//fi6oK3AThOKVgiVAly+9dH8nmh5LTwEgf366zvcfYSKyVM7dlBVqlKVqlQFluLu/1xj9ObHCYFHPT1KUEAdA3I8WnCQkWSwnCJr9p9WO5I+N3eOWr13L92/ebMKpCr4Ax24ghleNnOG+rOJk2jayFq3OSWK9nd10fLmZvrnLU0Uj1PBPJ3qYyZCOsC8BWqcl3ExmsWZBV9YP5m+tXARHejqUp99+ik6YEyiOhUfpfwkQbuoZWd91lyoI/QjBHsJ0LNjpCMzNq8NI0aob5+6iBpqa+mu9evpvi2bebYSx5YbiC5pj/t+QH1xEmILukrlOIf7568hYObl06bTp2c20oHubvWXK17SHUe6fXCWjHLmwXb3O+vnxTZnsNchQO3QkeKgu2HffqJpVJWqVKUqVUnUhTVGeS6yrDKBTzTgjVO4ERB1VPwkDKo6gOrfnnk6nTVxov167LCh9NO16xgt2D2qxg4dRne873z1nhNOKNm3JVMa6CsnzacvPvMsbTPmS9+E6CDnmNpIWs3RuMxqx9bUqNFDaxy7CyZYiZVEVzeeSGNqauzfp8z7B7ZuFcAVzdZsITeAZUErMlyK2bHEoOcLQ3kAFtZ1/eEpU2numDF230/OnEG/2tqUCQYL9uNoVGYA5YhrTknyRHWUuc7zJkyiCMrcFQqnx4ePTZ2Ofe3ftbPnqFV728JQKml3FnnWLYcP0+vYT4kocR4/7w/uNgbmYrLn8GGqSlWqUpWqWJLTWGOU6Xj3McvxPEtlSyKJyg1a0FMH2GC6YRPAlShNYfH+r049hcoBXJapI0fSf1t8Gv37Z591TTiAd4xSI+7JG1eR5uRBCcfcuGghnVE3gSqRL86da/8yXU4JQPevV7xCK/bstjg6ZUQt/fV732uZazwoYFgOTo02gMfSYI79+bnnZ623+c5rwf7/b9qgntm1029ygPfB+gb68px5FkgLiMq38ZLJDfav1H7Y/rttW+n/bVov0Nm7DjzbzwZQZWXPoUM0kPLq5m3UebiL5jVMogmjR5Z1zJbde81fG02vG2f+yn8eKxX064+r11LrgQ46d84smt8wkQZLXt28nVY0baMZ5vqWnDyXjndpPdBu7zvuebnPSaXydvMuenvHTjptxtQBfa4guBY8W3jGvnzxOTTQ8nbzTtqyZ++gP0vPrd1ETXv2mfPOGbD7NqiidaPV1swiUV6Qywh6NkUcHAVJlABeEdiUMre6lqNv1383ddRIumzmzLAHTMhvGVN0jpjjAJxTPZCdOWGC/XuxtVXkyOoQbKRCTLED3NvPOYemCBDsTwFoLh5fB9C1Y3CluR587q0Yc3NZ+yHb9WsnnUzPtO4KBS7qDWibbYoGWD46dRrtPHyIfrd9K1kDCFEs5ZHJ7Doa8ujqdUbR7aLPnn86nTt6Vt59oDAeePVNWjRzilUaACN8vnTRewZUOdYaiw+U4nPrNtNuA7zzG95PgyU4N877atNQOscA/kjz+d0qHWaMO41FBWONCQ5eoag7zDaA0+72DrsP5Nw5M82zckbRtu57YaV9xX7ljhvOe/czL9lXjPvXly4Z0DEHAOE8fO6BBCSM5+2PPR/GcDCB91lzjfh9A1Ou/LOF9G6QGpEbqqJzkQN92WSpKBXdSt5kKuzPOZ5Z5Xyn/P4/nnRS6vsrn3hCb2tvlz7Z0Nw0A56/uPBCa/aFXDt/Pr383HMiUjj4lUXnFX1p3rwBA1xI88FOemj7tuBXBgMdLGk5eDDk2+L8502YkBrxHeb73ko+1GRTNORsYzVY1rzNvmeTPoXwuWNToCBWGhYcf7SOHSyakVsp6yt3/yZn2/X/5v39wkyXLjrZKkf0wTGtvoM8WDorwGICRQyF/OCrq2nhjCkl9wcLPJbA+bblz1mFL8UBrNvWaSbu5YzDyKFDafr4E+zY47WYrDFs9dWm7bbdW5Y9ap+DcgANQI2xxvjh9XbT9+s/1LtJFlh5OYLrwTO13DDeiw0TLCUTRo+i3ggmcB9ZeDLd9+JKWmYmq/0xiSv3Gi897T309sNP2d8xJky1ZZ63t9c6GFIjQTMGGVFOkA5ly0D677UH4q0dHRYsgxjAToyfGFTXsFb1ccFyf9vURADcWKBfpMIYMT5c/bP169WXDdhCwHTPqKujl3bvjuw5hiyF3J2ThOn6Fxs30E/WrrWMOgZVCS+m6yQhv1eWUVTi2oIrW1aG8uwOAUh3blivmg8e1IvHjRfOYseI3zdpcti0om0PNbNfWqfPT+KsOXZl5SKq249002+2bkFn3X0wf9KkDMD9dy88RxTbt309x4wb+v/c7la+ie4sStSuFhWvxOyLPjV9Jl09wzHHScNHEBccEfMsdQxjrlWcdz/zsn0PRbto5lRrosqnLCaMis8tFHpHV2lFDnnAgNkuo2BLCRQFlPhdhgmVUvrlmIPvfWFVmEiUI3801gD8lZJvf+JDxxToYtxwHwsJ7lutAdTWdncPFpmJRZ1RthNH1ZrrGGZBCW1UwgJhDfl63RL6/sNPWvD8/iNPlgTeZeY5WGH6if7A1IvJAu4Pno9LzaSrUrn76Zf7/f6i/7i/vZVLFsyhlcZChH4B5HtzXVK++etHKtofv8vvLFte9v7/57OX07EqwbysRelDJdWqDweKlDITNex3/ttVr9Etp59uQe6fDaiGXFnz/3/IsNzb3n6bUmDGtJlPa/7/xcaN9OezZ6fY7pcM21Vs/k5FLTvWZXyroZHHd7RYJuqZO/+byV1NwmXyfEMHUOeSkBzNSxzHrEI6kZGHt29T5o/7bfuFKGUJur824/H0rpbUNVKqyhYHOXs7OYn5jYhDVsKMv2rf3gCTLijKCYqXABs/PXOWjVaG/Hj9OmMe3kIUpxCeMMcpSCrZ2PTp9f37wsc/7WmlTMGRYAeho2xeLiVQxKV8Xt/+ZFRGdz39UjDblRLnwytfOTpf8t6i++w+MLFs8x0YXO272GwMc+JSodzzAR+A8Zu/fjgAXn8IzgOWysD7HcN4bzDAm89K8agBILgqIDg/9sErjgErrDP9OnfuLDoWpVy2yYLrwPMOgD9nzsyyjyvGOufX92+cQyW/x3yC+4l4CLgWBspkXxNzM4nS1Yl0iGQNaSp4r9OVoMYMraExQ4ch7YaueOwxWfDCZoSC/UqWC0Deblgx+48juPjcGA/++7q69M8N273Ws90znG9XGbbLzMzXxrAHW+AdI9if8iAy2iimMTVQTL7qRMYLGQFYWM7ZV+znHB3dR7wpOSAv13dOpURxtPboTGATmKq3xWtRRdFl3nLAGokKjSHhypdjFHmx5OOlV7W1qR+tW0vnTpxI69sP0AfqGxxym2/rRwwPgAsB4+3oORJSjdKXK25mZliW79xBo4bU0B2bN+hQV4xEhLRIkTpWpb9ACWAJExdAPGt2huKY109BUpJ1Q+CPfm5dkz0vWJiUK8461QZovVsFrLsU82bAO3du+SBQjkDhfuOjS+h7BngRQHSvMR9nzcXPrttkrQ4QTA4YlPF6xZkLrTmWrS3FgBf3GMCUVfKIOVjaR0ZZTCplmyxgnZUcW8xVU8wEjwkPYjYWzWgwx0+iciSfq6gSwfMEq1Q5Fo7eSk2sqsTv2IoaCzaQqBZFMUXHAuqvLr7IgK77YWzr6FDfNYz30eZmVsv6L+bMTml3sNzIkhMfeSz8xuTAZf7YsWrZ1q3607NnKwbTj06fTi/v2UOMHMZ/q247OwRO5TCuhtqRdPf559OYwtG9hURl3//3N17X1p+Lz+kFBURaj0N/MwnJCTAKQJVkgCoW1SIHag6FJZiHFZ6CKVhbkP3SHMeITj2h+Cp6+N789ZqR/uWJ89QP16/xl6p0XLDo6AgYCAsUImS5+XE+t9Yx1IEIuMAPEbNg+FOzAVEA3KxyhMKoLQM0SknT7n1WuSMqNgu672bBBOduY3UoV8Aql3kALiXlghnu3w0GFGD9yD5TuCcwA0PQFtqUAnMsfM4wMRcDXr7OUgFex5uwaZ/95OWCbl/lYmNlwj0r17XQG6mJGl/6F6PiJ7+KDEWPn1e6ZKORGXAhiB7+wdln0ReeeYZe2NVqsXy/8I9ZlutLBjqbsNYikMtvI/21BQvo0yeeiH3V483NtNSALYl9+D22FwqcOnDkiF46bZrqBeDmlXljxhgzskdWrpalsmUg3djBvCyPPX/iJFo0brzcicQFWcMxCeBd2bbXmI/bmD0zN/UHaFvBanLmHAMps0aOIqVkkraYKxwFyWdCahJmWxlcs9L42r75q4ftezYbZgU+ODb7dhbw52KmDkaLc8OsXCrI6rbHXJvfWLqkT8FTUN7LfdoRFH2W2eJaMRHoDxksxVaOwHSeZf1ZYV9upWb2kUPL3xftZs3WmHwxw8X9yAIu7gmAYqnfzsCLZyvrOjjNWDDuM/sCfOEnHcy0mFJ+T0xu8bwPBOPm32EhE/d9ZnzxzMPCc86cGWWbwnsbvMYi79lAAW9NrIgQlbq3f+qU/9SzLU+DLds0jFZ/xjDZMZmH+CvGh/ti6zN2v59v2EBj/fc/M+9tgJUw5arAbt2pDdjiz34JQEVhjHvMcfj+nk2bUsUxHt+xIxS4yArMwS/v2U1foL5L88GDdN9m7+fzM4NIXUOMEfGWbCrQJ6bPKHWKNHoZvfovO5rpR+vXUjuKcRCRsAvb4LU/7tyhPzC5QdWXmXbUWzHnp8dbW+L1ZqpsEQ2+T/ea8yIjWLbS/TjgYzqp3oGGjdr1CpnKMICnFHaR/aEU3zY/Qvwgi6X/oD8AXLTbH9HKSwzwQsmDyWdB1waMVcAIC0lfA236W8DqizF79uVCvm7MwIMFVjAzP+qDlnAvkKomhU2TJ5kJ2hXWJx2VOO4hTLMyCAnPCCKPYdYEmOez0sD8zKy6N4Jx7Iv1ZyDGFs9saxlBiHi+iwXTFZK+BFINNPDWxIpIvhKSNflqt9VZOx3nTTKRM2bjW3v3qisee9yWc1wyZQr9xezZ9ntEG5Onbvu7u/Xfv/FGjH4WvkTk/c43DPIM45dEdDKOywL4A8bEvL2zI4I0m76N7l+7fz994rHlNO+EE7Txo6q/Wxx/ADjgld276ZNPPG7BW7gkgyFXyb3FagqfP3EOnTZ+fPj2zg3rdfPBTqXEtfveOGdyWOTBvYwe2nc/IgpfAPB+vGGd5m5r7xPGuO08dIi++OLzfkk+rSYPr6WfnHlWqo1fNG2i1/btpQ3G59vhyzViHCYNG06fmjGTlkxKr3fbYtq8cfUq27a/Ti2rjrmgNzHZKAvS+l/OEf47sL9WmwM7MR3c4Us+LzQK55oSZjv5fbFAKpwDDIbZbiGRTFyawkvJkgVz7cw+K1DuUMr5zgvWVioYhftTbL+6Y6jwQDms5vuPPGVfz7X3XFccFASRAT5cZCUriIbGfbd5uObZ4LHMZ1JmwMWEq/NQlzVVQlFLJQ4T+LOZPN5LzH5wjzDbzSdhEtkLKSetarBl4YypNrc6KzbY0LiMYOUoFidR7n69lYEE3hoRUONjknwhDOt/tAFUxDxLqRhty2knYKLNxgw8fWQ6Qk1FRirNpOqksWPJgKw+s65O5QNZKd9bvRpBV0qL+sZM+bjbBtQBrmpq1szsQR4s1eawZmo0c/qO9qspMX58bnYacJHugwjlVIS1uDgisd6u/3rO6DHheDDu9gryeSVzvWzadPp500bV3n1Ecy0o7rcVro1sNqLkZVY45QeyoaPd5fqa92flqdaFCOV/sMy6KwbW+SCuRExJJK1VR4HlHm1hVvJq07aC++CHCoESrySa8pwCwUCSDWXPW4oRQji4pK+mt8GSSoJ0AFTPlhltnhUZ4MNFVrKCiQqsGgBIKHlMcq44a6EH+yjSBwkgwFhLBQ0lPmP8CZYpz6ufmPL14/5iwog+wJWQ0wdj9q/ECoHnDpNH7u8lvSxmwalzE0b1f87rVX92as42ACnGEMKR4PkEzP/2pudL7tdXGSjghabWKifoRwmTst2kiX2vOdG2DMqZ+KBMdOzHZsxQ/8X4aj3IllTWP16zhpA2pII925u8Q5oNL8DjFxrImDqzebciOjjMIfgTRwa9f3I9fX52TDIHYH/3jdf9RSq/7kOAHxG1nOh4DgOAYim7R3Zsp9vWrgl9zQwSO8uDU/fcCRPpWwtOCbvMGTUGKUEq1W8lfaquP2Czr+1to1MKBFWdaCZFJ47M/+NpOXSQHvDFLxJfq1r7LgW0TcTShL4y2DtBXJWi9sy27vCa+11xVuAUmLI5vyiAkBUoBFa82cCYe19caRXLlUbhTB+fe5+KKQ9bRtKYzwESlbDnd6IU8+VKxlfK51uJZMfe+sr3xDgBACMikjH+UuliPwAlABPv8wEuCyZHhe4xirYgLgHPRT4rSrmKHs8e4gn4GewLKHUOIkPmfmMMa72Pe/6BCfa6UbSFRfrT8fsa6HKbWeCFtaOvk9caD2gxJSjwOZ0lduDA2q1hr5UDGh2gIEcFZ4otwE9bjNUiwArFL15q3UUv795D2w926qsbGy0z/rEBre2dBz3b9U1yzikHemVqANtiFHZPlQkUY9OopbiepZKaM2YM/dcF70218Q9r3gLwhjQoXxWDfNGMwODjRMABrmS6LZ0HKZX7rD1dzDJv/4r0ouxA+vmEd6PGycR7x55A9a5whZ48fLhqOXzIsupRFQaPTTZt3Hyym3nCtLyh4wBt6mhXb+zfZ147jGm621oOtMzNZvA9xqWYT+hRqyzXUiVSKwJk8gmnsMD0mA224gAeKNZKq11B+fRmhs1+s3dS3VqZNy0FExbkv0LymXf7IrnRybnR0zItKQu2EARJoU+SxaJwBqpccd5nofuA5+EGHydQ6TPJwjnD6A+KsABw+3LfGXQfWLnajEf57eBaKk1lQ5+XvGeOLd+JwED528R4wjrAliP8jq411zZYtczxe3flPVEHei/1VWoiKAmnZPDlKvbrWaWbuKX+IoiJnNOsMMgwIh3IRIUGkN21ywY84XNIQzH/XD2rUd1wsvNvXDB5Mn3wj39QIWKJ0YeBNlEyEow7kPE3KgZMCuSdrGFZzx01Wt16xpkk82vv2rCent65k+3GMk2G5yD+GjmtxzUrAReyzjDQaJq2DtkYhIR0Kd9mNKFnxzFMg1Js/xQDuN85ZVG8uH6SScOH27+zxkcT9M1vvaFX79/rV1PmEwYQPmaAFz8MKJ260bXGlDeuoA8T+4ExgQkUUkqlUn2gJFjZ8r5cchLtFosE7ksaEfddSjkFPXBcsRzGY7mCD0SaHiuNaJXS1/KAWd8uBICASUAWBAC4PAmrhDVmn6tK+wTwvzKP+bYS6RTPd7H4hUJSKeiiEtsMwVpxbkyWuQ52auKs3ASjtb3dWn8GY0LZn0ouMt24Xq52OSyMWQETgp/UMl6iTIGlrOnUvSS+DsPXXnqJLm6ot9bZlw3YbjcMkkK4loc/8wmBVacbnyMDrmvbncwxbQ/zPorWg6DGij/p0+v0RIK8EZyBwgN2w/AReQEXf+4YFa6GQSdVV1rSebNp7ujRqX6sP3DAf+WjfjUX6bDdEOZibiv39rIh2U927P2abSYKVKZsNA/na/v30uRhw+lPbbvBXi0zXmCAu7F2JDUas3MxdnzKmLHqzQP7wiSGx/ao5QzlETAOjvAE2yjm62RlCB9qb1Ih2BTG5keOfu445BnPgrn5qyd5sOxtwQ4EjSGVgpXhQPjajkVhwOXr7m1EK6SvNbVxX/m+FwJbiIxyBosuxwzK4Jl9rkoJakTbNCXDAD9jGPVp/ZDP3eTT0NCHJWXUdYasqaBCGyZMEtixIAh8yK0HOsOKUDIlDMFSWL3pLdP+GuPCkc8AWD0muZUU0ahEoC/w24MsmtH3sY1MlwGXQUBHM2b4TpMKDNiXcPRf5yhfd0gSGCICin7XtCVWQnLIDpOzurC+nk6fUEcX1jfkzav9v+vWWSabRBS1lHD0kBr1hTlzad7YMTlVoEjUZOb+MEhHO61Wi+vGpwD3keZmbQBX+q0zlgD3msSmhY1Y0cJxcdUhBHC19xzRziWqYo3nEA3sR9ol/8YiGzlXIszKfmb0/O5WuwIQTMPtPlgL5uWdxj/b0dOjDdirTcZMjIhkmKyXNky1fwiiundLk7p3WxMA2PullQHekbYtmKxnmfezah0Q25ShXS2hHz6aLtzDoyX4YYLd8Q8TP1L8OC82gFeukuiNSBMey0i/lCVyaqHwCs28e2vqlUwG1zjS13LOil1pKcMwWPmD+eQrL9nXCj4DLbkTjd5Fq670ixj0h1x7kfOT5mOiYULm874BuPJ5LLQikE0LeublVBoNP1elhK+rP02uDPwI/ip3YrqMVpcNuqXqS+M+cxogMhB4rDnYEOOLMYN1CX3FH36bGNsrje+9vwrJSGsF+tQf+co1oeqRCESK/1AEVi3JLGOWjtWkcsQDM4mgK2MGHmOAcv4JY+mi+noLtlNqiyugf9q0CQFVKniOfV1ktAuz81Wz8psxwsQgCYs28JpJ5KJxY8FjKd9d/Xokxt51HKt2hbqNETgTUTmKYF6OTHd9+wGfhhUB05u24ySHO+dDw3Oug6+F05P8JAAAe8OqFRplGpXwx8fD3PVhQjFq6FBtwDR8Ocs8PJNHDI+WdiMGqGnTwQ7a1NkR7j3aRvnInYcPuSgyFczcInBscAWF5e/708ocEyt+oFBwKVNv8868bbBCwUy5UK7g0kyhgqwJD+dCcAUHfmDWjrQTyJo87bFitEvurd1EhQTfY3EGFlwHm9g4MIb9muWAN/d3MINi+kukwmMB4F7Ti8pNyOntL9DNB2xZH28+vyOux06Azjw1VKfCc4X7u8KzNkyM4Dvk5+poCZuUKwlUquQZg48b41E7bJj5zdb4yaRbpALpa3JCwxNDRHDzM29XjMLiIGaSjTFEfx/16wsPFOAWCpCrVGpSgJkKOkpbj7l8ISt+u0fiIl3zrUAUgcuB1PyxY+iGBQtUuYvLw8f74NYt9MvNmylwblGrGf0otLRes616FX2t6RRdnQK4PKjhOqzCWr2OGEcQlo2FWDLAMtJ9ZMrPyrY2pWTAkZ84KDGl8a2FvuWirt8iJkd4A1b6vYWLVZlBU6lm4a+VPttSx/60aSM91NIsburRMytjCAG4+JGebRQXVj7hPF35Q3U1i4v7OYstQADGKH9gDLgMfPgOLBKCH79bRah0AYPOEvuhXQm6yGW0QSY+SEcqtlIKgIt0QJaFAK+Bq+XbX4Lr/akZbwYi3Av46aEAYYYsNmkpJAM16cgXUAWz8zWZgvkp/25X1Fuh1KFPRUKFKg4gGujI3GKyxk/W8i2FWUiCNaIMYMI+1/RT2Uu0hSC3/qy/PVCAC3EaO4CBYL0RWDw5S0XOxqAmb+rNRg/HXCPX0o2LToO/tmBHkG/7xI4dtGb/PnqipcVGL+PIS6dOU9cZ/+6Bri711Rf+xDm3tlNP7WyhW9543fhzRyhUgfq3xtwazu/xjP3USRooHBjmZku579i3KuoiqwiP2hPUcBbOl104Lp0G8tq+NgmWgSm79hSPjgr5tnnCwH1P5Jjaf5ZMrq84Srm3csGESQ502fgd0oaSQQ+kQuDE9X7FF4DsVuN7ysdWAVLYFwuLQz57XulVQ1DfGD80W4Iwsy9mz2AevLA5s2iur4xBKLbyijRvWjZbwDeUNVlC6cloZy75OGN8aYXMSgPnAvi+E4A3a2blKOVlPvfZFgjp40oyfZV8azVDOE2sWEAVrkeam3FvkCrEIJ19ro6G4LrYsjIQEcL3WnfB4V4ct7Js9o+x620VroEEXAjbJtn+6Qvq8/sMo4n5sS4QyIOFT4HJ07wv+Wh23Z+JXgbIrtm3jx5vadGv7G5Va/bvD6UmtV/pqGFELQFw4efF36caG+l/vfmma9jbZB/autV29CNTpqoAuorSPDbFTlUEDb4mARxK8QrtJKKOSaT62L3CMojuO0ecz5sQnfiYHKzzQVQpU71OAb6mJI6VKmSqTxKdcQPQC3tarY92MID3xb17eKZlJ0IqLKs7+Iy31hY/L60IOBpyy542y0LAHvDjKaTIbErAM44Z5wuEAohLn6j0eXG/Cs3cwbJWetaGHzGYOvJ9y2Ey2TQTPm+pClKuaMQm+56VD/J7j3XgxQIPzPzy+SjBIs/rxcpKyJHuL/Oysu2tSjFb3M98Zk2pwPPVacZ9kM9k9rk6GsLFXQZqScJXvXWq8uPKD56zvt1egO5AAy6kJmVm5cQbAbipIhNiCTsLvsHPmycAKOZ02u1/s2qVvnrWLPvhMQO0a/fvsyUiY3lIB3CIQr6goZ5OH19Hp9XVpeoqo+wjnzCUbqCc5XilcGpR2vydNlNnxG1JOAiL9wsMj+KIeH8uGhs5tEafO3FiaG7Vvja5p8VT71TWKfNyzNulgtQ7A7i4gg3t7erLr76kUfAiRhM7x/NV02ao946p7EeL/NxfbW+inYcPp/qws+uwbj100I60p/zBu6COsZShfAJmgfUxocwAOvmAV1YTAvMoJ/+zEp/XCs9yoUhRjxfnyrdUXDnC551fokTefd70LX3TON8tfp1XF5Xau0pFAykIRtvd3m77lk/ZYds5vTAjokZ3X0EX9wyKHGP3kYUn2wUMXMWq/D7eB7wPF5KvTjMk+yz2xpfan4LJGhfWqGTNXEhnmeblz55X2qzMVidEJvNEhCes+I2WenZ7ayVY7u/XQAEupCZLCPmNX00nvbeMVvasjPN+cn26ggWZdyjneOubqwOwsNsUBTPmjRlLF9RPVhdMri+4TN+D27bR77f5xeJV+hyOgMZD7OL1vEvM180BLsd502zNBlkpiuve8nVrUjIb2FnUtS+aodV5dRNT7fxhR7NKxGcdo75DEFcAXO5XnmIT2bH1Vmm7qbO7W70BE7a7HfReM45fPXGemjQ8dxEEWTRjY0c7jRoyhOR+yM39cuNc+tW2Leqhlu2uVrO3fCg/wSBR1UtRoLvHtEBB8oLk+PECdGQpt2xBgXKXV2NFUMrn5XKHHXNAKUe5WhG2V8o4+bz5KlrZ70V6TZZZ4ZoReYvvm3aXn+QPk6f1Z8N3Ngjr9xZjKPA19qYiV2+YlRT49N16ylPtPcTkoJDgHtxl3BrsT68kb7bc52ogRD6rYLmVAk5nmalspSxV/Jvk+Ale2ALvkZMOxjvR9O0jGStBfwjqZcOFg2dwwBaxdxUZVEgHwUZWpkmSpH21ziAa3LnWfEzsAM5IADvvK45gZeskX1BfTwDZeWPHllzvtvlgJ/3vt98kbsh1QzOK6izTPcCBCvK64qIEoR82unfo0MDWbGCWCiAXiammGD3NBSx8TWJyQ6I/WN8QWodp+bW9e4nSyO0zlRIfCI3mEm8m16ogeglOzAU4KFTHsjMEtcCA7VXTZ9p0n6y8sX8v/eP6tXTltBl04cTJdhsilO/evJE+Uj+FPjl1emp/fL5g4iT69fat9GTrTsXsObGnp1h9i459lsvCS/pBWUOxIPoXfjWZVwgwucIoxnJ+xFzqsRxTtyzJx+Y6ADszzjqxvdzzFvO1oU+1Q4dapZ2PWeE4AP25ZbIYKCBeXIBlMIC3kGAhgVbdNwCt6HxYxMAvcZfP1y+Fg6rYhI/9Lz3t5LJT2Cp5rvpbeLEGfr56U+2LazX3Fghx/bywR76KWry+MUzAfzSMFBYk9LM/n8el/VjlrJDUJOyfJZVmLsLvmSr7x5m6CRX0i0LG1tTY6GLt17wDg726sZEEmy0qOPaplhZbreqpnTup3QCpx0JPtEMqkDtvnkCuwFg96Gfise0SeedNnJQCSwetkXGGoDJNKi5t6wm2HxOsnysXkl+1z69v6kHVB0n5NoM72legUqFgx6iaofTRKdNS17Gxo4OUWO3Hgb67dBS7uGraTLpo0uSc8QObvcsA62oDupRjhTDK5Ei3AdYt9ETrTge0wh+NVYiunTWbPmn68qNN6+nNA/tENS4XrZ6o2G96BwgDL+dQylSUbC5lKXluXZN9LZYoL1ecgfKVpmT0BSY29AVBQ7uNyawcxsvnLZanirax1F0xxVeJYkFZPikw1R9N0C1n1ah8ArbUG7bbJEybhcoq5otgBmhcU2Ft4HKeq4ESuCPYl94bt4eMlK90xSoJtpB85TRZan2AVJ1h0w8alwHyfXGsLYhjJppHK/isErEUk5kduQ/kaxnn+kEpsuCYKuOOavaL07P84QMftGk/f/XKy/T2/v36W6cuVKfX1RXtzCt79tCTLTvM627rv02bs7l3oks+4RVdTuX7Opusi1gO9tgkM4kgqq8doReNGxeaXHdgf8bcS+mTcugUV/Dyebp/PrMxBTz3bN4UgNLBUhJWZuJSj3Jw0RsERWFVIBkY9fq+vdTh0qJk4LidFUweNkL9/SmLcgKpYEa+b1sTPdjSLMKuKTcH2LsGdnUdpts3rlNgttfPnmcXrGeZaMD36/NOpp9t3UQPtzQrFSPJXBPvgNrLEChC5D5a324esyrMWWB0AF5ZXD2f8GLykELgIyNwWYnli4YG0PJyb9i32CLm8ryXDJA/K58gheWBUXF94t0HBo9lHk1Z05yOSs53D/OBLRdoqZQxlfNcDZSw6RzymfPP6JVZlfs+P7OCUiHh4jbZVKtCFb6ywoVo8NvBbxvgO3LYKjthsX8zB988X67USBbLRlX21RIJ62jgNA7EKDJNbNOGkdryjhJYwWi/OHeuAd5X8rJbgDLSfh73gVXt3UdSPl/K+FAz5m8VO5YWnhxw2UXPECmk6fjDPlQ/JQUa92/bkus/Dewyly26K6c0y93bZlft8ZZfHUzhKg5dqn3/GdWlJIACPH+4bo0w3it5XnVipnQj9n9wx3b6Pfyx8GlLswDJsp6p/itOq9rVdUh/463X6IK6Sepyw3DBdllm1o6K4yJqWqujwHLt6i8GILkqU751RrF9jfVDtloAlKvFyKpVAGFePeTZA26JOCgcKA78cAHAWQUkIxuzyiE7Yy+1ygsUM0zB9724MqSfwOx7zpxZBc+LvvU2yIbHjqWcaFAwCyxAgDGCSbz2KDMJKOpS+df9IVzXGUCAe8hAUihdSD5XvZn0FHuuioksAFPpeXEtYLgMuAC8UiUkbe3vTM3rNTY+wfW/VPAVznnL7x5N/W5hFcC4VRot7XJ9T7e/IwZfudTj/7x66THJfGsMKm00r40MLqybEx9tm0Y9/5a9muzc9TTqb1atpH886+wUwG7vPGj3BeM1bNeYjbtsHu6TO1qsr1aLaF5bLSqeMIKd83tyNyRDDOxzhWHJ15zotmOhgriP58ICdNhOvOPQwTCVWNnWZuskk4wwDjWplQB8rdjUq7yf87ndu9THjYkWwHfrmrcCPKrYTxVeVchGil0y21oOHVKTfWATSjf+3dur9c7DB+1uCakA/nzd8NUC3HEMyjTeu22L3oXKUeL+6OCAprCIvX1vJjcp3iuqjj25eyc9Zf4ub5hO75sw0QZcPbKz2ZvESScZoK0xfv/unh4qJCOGDKH+FOtjy/gYIcjJhSBA6BZfsYkFCnGaASowxHmiiAYn1D+7drP9wUKJSgCGAsmaMlnJZX1ezFhZipnIpPCMnf3NaGOXeS183t6n+uDG5Ru7cqJUeYGHSiNa+1twL3sz6cDEq5LoZYzzInNM1u3AQT6yP30BW5ZCz1VWblv+XMpaw+AFsK50XO72QUmQcldtcpH+T+X9Ds98KeDEGCH6HGNYCbMtJhJ8uTJVoTKdx4C01agk2WiApVFF0yUxIDjGG+mmiv9wLqsLwvLvAbCXP/E4XTh5skJEMkD1wW3b7L4wF3/u2WcosGSdsrDqGL0bGZpWIh+Wgd7tnKP8V+7dQ59+9mk92viSQ35sJLWhnw4MHXj9S/N2ey1zRo9W929pcrs6hPb5wrHGsvKs0F1q6Ijd/pMN6wi1kNcbP2oH0qBUbkaStA9rTmUK3SP1w3Vv09njJ1BL12FtzMrKtOO7G9OidKjZrKjdgOhXV76s04Du3gVrgYrlKxGRDGY80oAg3rOPlq3v5APq2MJx/46thD/yVNj3RLFX13WI1LAhxUF3ysj+jQBkJsriFgCPzBC5ufgeCnZewyRrHi31A2Tw5XJyAF8wwnxmXJgZAchZ5YI+wFQ2zdeqrUSRoO9gkwB/mOny1XfFeVFmMl+7NsDHKN1StXp5sXRpIsYYlfJnY1xuN/7nCRUEfQ2U9MWnWwno2ijzPGONZ2L5G+vsJA73qb+Ue6HnKis4X9ZCAfC6qhc5qfCN4t4iL73cwDr8vmAFkhW+6nxUe7nP/CU+572/QXEgKlP1txjduUKd/sADNxpgu4lCmowo3BD+dZIEEIb4fxNZKIJNud5/GVcuimcNzFZFkitYYyLMskQZxmmPV8EEHpoMxC6iathMlMPWIweN7ahMuzJnVoVLU+kRVHEtXb8LCaZJniWLoh9c8lEFEBfVmHVCqYvi8eEFESht0vf7xBKTJB3fAVTDdauwCH08t9vZv3L3Q4EUMYCUY173X7Z2GHNTR9qfL2XpzBl0fkM9VeWdKciXvH3589YMPlB5i+80sbWV3wEBO1U59kT39Fyf9Bw+/ANKFX1wOl45qPOW1aiAmfMEf2dId4nmX/tVCMRijoRjVKhnzGDKdlZrWg5gTamgLcFzQ04wm3xTflfFAB339/zMXUOEOAk0PF3QKX+lChHSxFMPaa5NEmbMEfgSPk1mEQmFilLKXZ/bh83EnJCkXOfdRftqH7yPDlOIMAHhsRALTiBQLJrBQ5pWuD5PZN2+FG9sgFIx5m5I44PiG/IMn8fEhXnXjazNdaoLWTC+eGBSVY5t6TzUbXMXERFdBVwnVcCtSm+lp+fI/VZ/nrFs2XKjTS9MRSynfK0USjOy0rc+XwpKPcQEqUyub3D7piia28Mq90SJIC0GQGM+FuyOUu3b3RzacClKIkncYuuR0EY7qkqdT7BZlTNASjI8ZuM6/3ZuQ2thGpCgpuJEIzBcZsC8NrBKnVyHfvXoVPdCtHk2wlzJ0p3KWiGipUKnxkTeHEwKzAws+K5VoQUswlTBtecuh2hz276QoyfljIkT6IrZJ1JVqlKVqhz3oujOC0ZP/LwtmnSkq+vzRnfulRGqzINYObMPFko9FkoQLJQiximSAOsZbjB9Jpzm45HUJcFSWMGX4gIK0Tiq4/niv2LZPpVmv4mW4MIYFVmip8XStJz3Ghzl9HTTndJHeoXcn3Cg0ky3bb+E2Zb9yQxWrs8R2BJPbXkMeFwT16q4LZ7V+ve2eIln+5Epu7FO3KgJrFSpMXFd0CmQVcJcrSk/gVUx+ovYkjBl7BidZEAaAVSXTDt2w/arUpWqVGWwxKjaNoOzN+O9Bd0Vl1++UQ2hm/CegZUomITtMUoJ5U2RMAXzLvZNEq3ErokK+MZ764DIiqv5JjrD8lQAARIApIK1OgRRKUHAAuDouC0JwOoBRQW4cbipInAQd9yCmQpgxtDro6ApmnpVZJZhkuL7LVh3ooSpm8KkQbMPPACzYKEphsyb3D/ed6x9jqx7VSTHSlwzT2SU/59NwxKowwXyBMSPgZgYKb4JYSz9tfnRGzYkUQ2j06XfPmAAd/zw4VSVqlSlKse9JD03Xzx+ykb7lre98OFLf2A+3BzUtQcRIgqgwywtxbgoBWREgmUGyGQXIgMqeWBS6ZWMGDhsnV/h52TmizJYKrUoQ0AMHSpJCSAM7SqGXVdJibd5f3QASyeaZBBRrBpFkSVH87cSEwMeCzEpsRbwkGqkeBLi/a1hUBjvffS2CqAcGbME8yTOgIQfl8I9U5kTUvCnh8lMHHM2twefbcIzEs0TDcWTFrdDNHuHMVH6hNpaPWn0KPsZDLcaPFWVqlSlKpYk3Xzh6Mm38ucsoaKzH3roOuPgu8nsOS4Cjye+Xq3HSNoYTOsUNeksCEuWq2Tgs/DzaiXTcOSxQrETCaB2SG5ZsghaCqky8eqEH5XS/fJ9ChG9PlooXh73WbbvK0rZClM9GWD3o6RjEY5oUpdDHXyrqQhrtoHLCU4K+XVsxvq8w8Bn/LjyVDFyWouJD+nMdblr0yIyOkST+4j12Nfoy477xXPR3hOGJL/92IwZHzdbqhFUValKVY5bgUkZDFcCLiTJ7vj8hz9sGK9abBTxnSm2ycrWLxwQ8Iys4rZwytG7kcl53kZpzFbCvGnXiiWO6g3WzciotGfHATS8WZWCaVQHs3O0rMq5gGC0Eaj8xSg2AXuwt2dMApP3LFIEj5HiOsieWapoFQg+XdunxDNMP7CKA6TDgZTyoWu5TUsQjksoun9ycpRd83HG4vro2b8S+bhEofaHZMhhjWRS0oFM0RwvPQTENyH23TXy+JDuZPH/WLD4c0e6uxabidtdVJWqVKUqx6EYxfpYz5GuxVnAhahiB57z+9836iHq46pHX2bU7iKjnMdH9ctFE7Rka6nIZckUI0PNvKfIRoMujykyEYQozfrCR8k2pemZVwbS0ucar5pNxsGkG8HO5QpzBawkiVHCngLLQRPj4T8LABSvShJEMQY6fwR16K8O++I6IrPnc3FbiaeaRNL8kISgNCXvtYhqjuPrRpDvhb3mROVGSBPxdGejOW6j+fax0YeTH9y6eHEbZWT5nu2NSc0ww3r1ZeYUp5lmquy3KlWpyrtOjJrcaNTnRpCPnu4Dt148/sS2Qvv+K5L8lXZm2BJHAAAAAElFTkSuQmCC') center / contain no-repeat;
}
`,Qi={"disease-brand":"index-module_disease-brand__Qqq-x"};ve(Yi);var Ji=function(){return l.a.createElement("div",{className:I()(Qi["disease-brand"],"dxy-comment-disabled"),onClick:function(){return _.redirectProducePrinciple({cellId:"\u5185\u5BB9\u751F\u4EA7\u539F\u5219"})}})},qi=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_simple-module__hK-P9 .ck-content p,.index-module_simple-module__hK-P9 .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__hK-P9 [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__hK-P9 [data-menu-index='1'] h1,.index-module_simple-module__hK-P9 [data-menu-index='1'] h2,.index-module_simple-module__hK-P9 [data-menu-index='1'] h3,.index-module_simple-module__hK-P9 [data-menu-index='1'] h4,.index-module_simple-module__hK-P9 [data-menu-index='1'] h5,.index-module_simple-module__hK-P9 [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__hK-P9 [data-menu-index='4'] {
  margin-top: 8px;
}
.index-module_section__Akdig {
  -webkit-user-select: text;
     -moz-user-select: text;
          user-select: text;
  margin: 0 20px;
  overflow: hidden;
  /* \u533B\u5B66\u8BA1\u7B97\u94FE\u63A5 */
}
.index-module_section__Akdig .vip-tag {
  position: relative;
  margin-left: 8px;
  background: url('data:image/png;base64,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') center / 1.375rem 0.875rem no-repeat;
}
.index-module_section__Akdig .vip-tag::after {
  display: inline-block;
  width: 1.6875rem;
  content: '';
}
.index-module_section__Akdig .vip-plus-tag {
  position: relative;
  margin-left: 8px;
  background: url('data:image/png;base64,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') center / 3.875rem 1rem no-repeat;
}
.index-module_section__Akdig .vip-plus-tag::after {
  display: inline-block;
  width: 3.9375rem;
  content: '';
}
.index-module_section__Akdig .more-title h1,.index-module_section__Akdig .more-title h2,.index-module_section__Akdig .more-title h3,.index-module_section__Akdig .more-title h4,.index-module_section__Akdig .more-title h5,.index-module_section__Akdig .more-title h6 {
  position: relative;
  margin: 0;
  color: #333;
  font-weight: 500;
}
.index-module_section__Akdig .more-title h1::before,.index-module_section__Akdig .more-title h2::before,.index-module_section__Akdig .more-title h3::before,.index-module_section__Akdig .more-title h4::before,.index-module_section__Akdig .more-title h5::before,.index-module_section__Akdig .more-title h6::before {
  display: inline-block;
  margin-right: 4px;
  vertical-align: text-bottom;
  content: '.';
}
.index-module_section__Akdig .more-title h1 *,.index-module_section__Akdig .more-title h2 *,.index-module_section__Akdig .more-title h3 *,.index-module_section__Akdig .more-title h4 *,.index-module_section__Akdig .more-title h5 *,.index-module_section__Akdig .more-title h6 * {
  display: inline;
}
.index-module_section__Akdig .more-title p,
.index-module_section__Akdig .more-title div {
  margin-top: 0;
}
.index-module_section__Akdig .more-link {
  font-weight: 400;
  position: relative;
  box-sizing: content-box;
  display: -webkit-box;
  padding-right: 12px;
  margin: 12px 0;
  overflow: hidden;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #333;
  text-decoration: none;
  text-overflow: ellipsis;
  vertical-align: middle;
  background-color: #f5f6f9;
  border-color: transparent;
  border-style: solid;
  border-width: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.index-module_section__Akdig .more-link::before {
  position: relative;
  z-index: 99;
  box-sizing: border-box;
  width: 2.875rem;
  height: 0.875rem;
  padding: 1px 3px;
  margin-right: 11px;
  font-size: 0.625rem;
  line-height: 0.875rem;
  color: #7753ff;
  vertical-align: middle;
  background-color: #fff;
  border-radius: 0.25rem;
  font-weight: 500;
}
.index-module_section__Akdig .more-link::after {
  position: absolute;
  top: 50%;
  right: 0;
  display: block;
  float: right;
  width: 0.375rem;
  height: 0.625rem;
  margin-right: 0;
  content: '';
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAHJb+yRAAAABGdBTUEAALGPC/xhBQAAAl9JREFUOBGFlM2LE0EQxacnDggeArl6MYecwyb5DzwJCgui4Ap+IagogpKDCCu66kEW8QN2PQQXVlaFPejBi4cFLx7z8Yd4FhTdxN/r6e7tmQyxIenq915VV9XUTJLEazgcztIYyO3ZbGbmUcSDhL9vlkJTk/u8DiQQMkaj0SerGo/HF2J5Op1Ot4PUMwI8GLIA+IPgkBVxuOoVumo5HERz+GFl7s8AnMHe1bnb7abGmELW8SWB6PV6AQ+Gi5hQ0T71285JONdCyDuR+GWIQC4rEO8d+QHv87INvTlOO/bswZivJHrCiQ42vAcHp6KVQv4FUmfeFKn8pCR3HHEd0auyKCWZS4DPHXGbMtdjka+3n6bpPRGU2Uf01ItCmQKo6AoVvZVNyx9S0aOCQAR5LLN9ls26XyUoPJNCq7l7mjvmT1Z2ELiHZCNyd80/9ppU3Kt5sjZkBrkvXCvF8xe7HbZ6vX4YUp0NS1csudORVqv1OzDOsHdS/zkatKNBIcKg0+lc8zmUHcpnQwpytLMRkwTYIN9bMVZl2wwIoEAbCG6URQR6QaC7Zdyfqx7EGuSqF0T7MwbHzkOEJXMBPElGSv+1svOY2x8T6IHHyqTHw64GM2DvAPLvgmOYzlWa/eS/AaRnEPpshTkXTn/WFwbAUU3dlDheOG7S2JvCKgPgeBHRluYidsTexvEyXJj4QgAc9R37yM/OrXfGYZd6V9jDDHvONoaOn+Q2fYQzT2jH4Qv4aW7Vy1C5zGQyOUaXvyM86hU47jUajVPNZlMvysIVSiCLLkHWsiw72263fy70ish/1kUOgTMTIBQAAAAASUVORK5CYII=') right center / contain no-repeat;
  transform: translateY(-50%);
}
.index-module_section__Akdig .icon-dui_roundinfo {
  margin-left: 8px;
  font-size: 1.25rem;
  color: #999;
  font-weight: 400;
}
.index-module_section__Akdig .index-module_calc-link__hdcvY {
  position: relative;
  margin: 4px 0;
}
.index-module_section__Akdig .index-module_calc-link__hdcvY .index-module_calc-icon__4DhAZ {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: block;
  width: 1rem;
  height: 100%;
  background-image: url('data:image/png;base64,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');
  background-repeat: no-repeat;
  background-position-x: center;
  background-position-y: 0.25rem;
  background-size: contain;
}
.index-module_section__Akdig .index-module_calc-link__hdcvY .index-module_calc-text__3ZgI4 {
  padding-left: 4px;
  margin-left: 16px;
}
.index-module_section__Akdig .index-module_calc-link__hdcvY .index-module_calc-text__3ZgI4 a {
  color: #7753ff;
  text-decoration: none;
}
`,_t={"simple-module":"index-module_simple-module__hK-P9",section:"index-module_section__Akdig","calc-link":"index-module_calc-link__hdcvY","calc-icon":"index-module_calc-icon__4DhAZ","calc-text":"index-module_calc-text__3ZgI4"};ve(qi);var Kn=function(e){var n,i,t=e.item,r=e.reserve,a=r===void 0?!1:r,d=e.anchorPoint,s=e.tableWrapperProps;return t.content?t.removeTitleSummary?l.a.createElement("section",{className:_t.section},l.a.createElement(Un,{dangerouslySetInnerHTML:{__html:(n=t.content)!==null&&n!==void 0?n:""},transformNode:!1,tableWrapperProps:h({maxHeight:340},s),preTransform:function(c){var m,f,v,A;!a&&Object(Qe.c)(c)&&(((m=c.attribs)===null||m===void 0?void 0:m["data-menu-index"])||((f=c.attribs)===null||f===void 0?void 0:f["data-anchor-index"]))&&(c.attribs["data-plain"]="true",(v=c.attribs)===null||v===void 0||delete v["data-reactroot"],c.attribs["data-menu-anchor"]!==d&&((A=c.attribs)===null||A===void 0||delete A["data-menu-anchor"]))}})):l.a.createElement("section",{className:_t.section},l.a.createElement("div",{"data-menu-index":"1"},l.a.createElement("h2",null,t.property),l.a.createElement(Un,{dangerouslySetInnerHTML:{__html:(i=t.content)!==null&&i!==void 0?i:""},transformNode:!0,tableWrapperProps:h({maxHeight:340},s),counter:!0}))):null},Tt=function(e,n,i){Object(p.useLayoutEffect)(function(){var t=new IntersectionObserver(function(r){var a=r==null?void 0:r[0];a.isIntersecting&&(n==null||n(a.target),t.unobserve(a.target))},{threshold:(i==null?void 0:i.threshold)||.99});return e.current&&t.observe(e.current),function(){return t.disconnect()}},[n,e])},$i=`.index-module_simple-module__mE4Te .ck-content p,.index-module_simple-module__mE4Te .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__mE4Te [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__mE4Te [data-menu-index='1'] h1,.index-module_simple-module__mE4Te [data-menu-index='1'] h2,.index-module_simple-module__mE4Te [data-menu-index='1'] h3,.index-module_simple-module__mE4Te [data-menu-index='1'] h4,.index-module_simple-module__mE4Te [data-menu-index='1'] h5,.index-module_simple-module__mE4Te [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__mE4Te [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_guide-item__iSHfS {
  padding: 16px 0;
  margin: 0 12px;
  position: relative;
}
.index-module_guide-item__iSHfS::before {
  position: absolute;
  left: 0;
  width: 100%;
  content: ' ';
  border-bottom: 1px solid #e0e0e0;
  transform: scaleY(0.33);
  bottom: 0;
}
.index-module_guide-item__iSHfS:last-child::before {
  content: none;
}
.index-module_guide-item__iSHfS .index-module_guide-title__fWO0G {
  margin: 0;
  font-size: 1rem;
  line-height: 1.375rem;
  font-weight: 500;
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  /*! autoprefixer: off */
  -webkit-box-orient: vertical;
}
.index-module_guide-item__iSHfS .index-module_guide-title__fWO0G.index-module_guide-vip__LZ-BE {
  position: relative;
  vertical-align: middle;
}
.index-module_guide-item__iSHfS .index-module_guide-title__fWO0G.index-module_guide-vip__LZ-BE::before {
  display: inline-block;
  width: 1.375rem;
  height: 1.375rem;
  margin-right: 2px;
  line-height: 1.375rem;
  vertical-align: bottom;
  content: '';
  background: url('data:image/png;base64,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') left 0.25rem / contain no-repeat;
}
.index-module_guide-item__iSHfS .index-module_guide-content__JLjKP {
  margin: 4px 0 0;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #666;
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  /*! autoprefixer: off */
  -webkit-box-orient: vertical;
}
.index-module_guide-item__iSHfS .index-module_guide-maker__IzvVK {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin: 4px 0 0;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #999999;
  font-weight: 400;
}
.index-module_guide-item__iSHfS .index-module_guide-maker-logo__a7205 {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  margin: 0 2px 0 0;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
}
.index-module_guide-item__iSHfS .index-module_guide-maker-desc__owvSo {
  display: -webkit-box;
  flex: 1;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  /*! autoprefixer: off */
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}
.index-module_guide-item__iSHfS .index-module_guide-info__TrXKP {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 4px 0 0;
}
.index-module_guide-item__iSHfS .index-module_guide-info-left__2Ctgb {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #999999;
  font-weight: 400;
}
.index-module_guide-item__iSHfS .index-module_guide-info-left__2Ctgb .index-module_necessary__ouaWd {
  width: 3.25rem;
  height: 0.875rem;
  margin-left: 4px;
  background: url('data:image/less;base64,QGltcG9ydCB1cmwoJ35AL2Fzc2V0cy9zdHlsZXMvZXh0ZW5kLmxlc3MnKTsKQGltcG9ydCB1cmwoJ35AL2Fzc2V0cy9zdHlsZXMvdmFyLmxlc3MnKTsKCi5ndWlkZS1pdGVtIHsKICBwb3NpdGlvbjogcmVsYXRpdmU7CiAgcGFkZGluZzogMTZweCAwOwogIG1hcmdpbjogMCAxMnB4OwogIC5oYWxmLXB4LWJvcmRlci1ib3R0b20oKTsKCiAgJjpsYXN0LWNoaWxkIHsKICAgICY6OmJlZm9yZSB7CiAgICAgIGNvbnRlbnQ6IG5vbmU7CiAgICB9CiAgfQoKICAuZ3VpZGUtdGl0bGUgewogICAgbWFyZ2luOiAwOwogICAgZm9udC1zaXplOiAxNnB4OwogICAgbGluZS1oZWlnaHQ6IDIycHg7CiAgICAuZm9udC1mYW1pbHktbWVkaXVtKCk7CiAgICAubGluZXMtYm94KDIpOwoKICAgICYuZ3VpZGUtdmlwIHsKICAgICAgcG9zaXRpb246IHJlbGF0aXZlOwogICAgICB2ZXJ0aWNhbC1hbGlnbjogbWlkZGxlOwoKICAgICAgJjo6YmVmb3JlIHsKICAgICAgICBkaXNwbGF5OiBpbmxpbmUtYmxvY2s7CiAgICAgICAgd2lkdGg6IDIycHg7CiAgICAgICAgaGVpZ2h0OiAyMnB4OwogICAgICAgIG1hcmdpbi1yaWdodDogMnB4OwogICAgICAgIGxpbmUtaGVpZ2h0OiAyMnB4OwogICAgICAgIHZlcnRpY2FsLWFsaWduOiBib3R0b207CiAgICAgICAgY29udGVudDogJyc7CiAgICAgICAgYmFja2dyb3VuZDogdXJsKCd+QC9hc3NldHMvaW1ncy90YWdWaXBAM3gucG5nJykgbGVmdCA0cHggLyBjb250YWluIG5vLXJlcGVhdDsKICAgICAgfQogICAgfQogIH0KCiAgLmd1aWRlLWNvbnRlbnQgewogICAgbWFyZ2luOiA0cHggMCAwOwogICAgZm9udC1zaXplOiAxNHB4OwogICAgbGluZS1oZWlnaHQ6IDIwcHg7CiAgICBjb2xvcjogIzY2NjsKICAgIC5saW5lcy1ib3goMik7CiAgfQoKICAuZ3VpZGUtbWFrZXIgewogICAgZGlzcGxheTogZmxleDsKICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAgICBqdXN0aWZ5LWNvbnRlbnQ6IGZsZXgtc3RhcnQ7CiAgICBtYXJnaW46IDRweCAwIDA7CiAgICBmb250LXNpemU6IDEycHg7CiAgICBsaW5lLWhlaWdodDogMTdweDsKICAgIGNvbG9yOiByZ2IoMTUzIDE1MyAxNTMgLyAxMDAlKTsKICAgIC5mb250LWZhbWlseS1yZWd1bGFyKCk7CgogICAgJi1sb2dvIHsKICAgICAgZGlzcGxheTogaW5saW5lLWJsb2NrOwogICAgICB3aWR0aDogMTZweDsKICAgICAgaGVpZ2h0OiAxNnB4OwogICAgICBtYXJnaW46IDAgMnB4IDAgMDsKICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDsKICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyOwogICAgICBiYWNrZ3JvdW5kLXNpemU6IGNvbnRhaW47CiAgICB9CgogICAgJi1kZXNjIHsKICAgICAgZGlzcGxheTogLXdlYmtpdC1ib3g7CiAgICAgIGZsZXg6IDE7CiAgICAgIG1hcmdpbjogMDsKICAgICAgb3ZlcmZsb3c6IGhpZGRlbjsKICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7CiAgICAgIHdvcmQtYnJlYWs6IGJyZWFrLWFsbDsKCiAgICAgIC8qISBhdXRvcHJlZml4ZXI6IG9mZiAqLwogICAgICAtd2Via2l0LWJveC1vcmllbnQ6IHZlcnRpY2FsOwogICAgICAtd2Via2l0LWxpbmUtY2xhbXA6IDE7CiAgICB9CiAgfQoKCiAgLmd1aWRlLWluZm8gewogICAgZGlzcGxheTogZmxleDsKICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAgICBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47CiAgICBtYXJnaW46IDRweCAwIDA7CgogICAgJi1sZWZ0IHsKICAgICAgZGlzcGxheTogZmxleDsKICAgICAgZ2FwOiA0cHg7CiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7CiAgICAgIG1hcmdpbjogMDsKICAgICAgZm9udC1zaXplOiAxMnB4OwogICAgICBsaW5lLWhlaWdodDogMTdweDsKICAgICAgY29sb3I6IHJnYigxNTMgMTUzIDE1MyAvIDEwMCUpOwogICAgICAuZm9udC1mYW1pbHktcmVndWxhcigpOwoKICAgICAgLm5lY2Vzc2FyeSB7CiAgICAgICAgd2lkdGg6IDUycHg7CiAgICAgICAgaGVpZ2h0OiAxNHB4OwogICAgICAgIG1hcmdpbi1sZWZ0OiA0cHg7CiAgICAgICAgYmFja2dyb3VuZDogdXJsKCdodHRwczovL2ltZzEuZHh5Y2RuLmNvbS90L3M3LzIwMjQvMDgxNC8wNjkvMDY1MjA0ODE5Mzc4MTU1MzI4MS5wbmcnKSBjZW50ZXIgLyBjb250YWluIG5vLXJlcGVhdDsKICAgICAgfQogICAgfQogIH0KfQ==') center / contain no-repeat;
}
`,Se={"simple-module":"index-module_simple-module__mE4Te","guide-item":"index-module_guide-item__iSHfS","guide-title":"index-module_guide-title__fWO0G","guide-vip":"index-module_guide-vip__LZ-BE","guide-content":"index-module_guide-content__JLjKP","guide-maker":"index-module_guide-maker__IzvVK","guide-maker-logo":"index-module_guide-maker-logo__a7205","guide-maker-desc":"index-module_guide-maker-desc__owvSo","guide-info":"index-module_guide-info__TrXKP","guide-info-left":"index-module_guide-info-left__2Ctgb",necessary:"index-module_necessary__ouaWd"};ve($i);var er=function(e){var n=e.guide,i=e.onClick,t=e.onExpose,r=t===void 0?tt:t,a=e.className,d=Object(p.useRef)(null),s=n.title,u=n.id,c=n.content,m=n.publishDate,f=n.maker,v=n.newSign,A=n.readCount,g=n.makerLogoUrl,y=n.directorLead,x=n.readNecessaryNew;return Tt(d,r),l.a.createElement("div",{className:I()(Se["guide-item"],a),ref:d,onClick:function(){i?i==null||i():_.redirectCommon({type:y?re.GUIDEDETAIL:re.GUIDE,id:u.toString(),title:s})}},s&&l.a.createElement("p",{className:I()(Se["guide-title"],v&&Se["guide-vip"])},s),c?l.a.createElement("p",{className:I()(Se["guide-content"])},c):null,f&&l.a.createElement("div",{className:Se["guide-maker"]},g?l.a.createElement("div",{className:Se["guide-maker-logo"],style:{backgroundImage:"url(".concat(g,")")}}):null,l.a.createElement("span",{className:Se["guide-maker-desc"]},f)),m||x||A?l.a.createElement("div",{className:Se["guide-info"]},l.a.createElement("div",{className:Se["guide-info-left"]},m?l.a.createElement("span",{className:Se["guide-info-date"]},m):null,m&&A&&nt(A)?l.a.createElement("span",{className:Se.divider},"\xB7"):null,A&&nt(A)?l.a.createElement("span",null,nt(A)," \u9605\u8BFB"):null,x?l.a.createElement("span",{className:Se.necessary}):null)):null)},nr=`.index-module_simple-module__vMXMy .ck-content p,.index-module_simple-module__vMXMy .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__vMXMy [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__vMXMy [data-menu-index='1'] h1,.index-module_simple-module__vMXMy [data-menu-index='1'] h2,.index-module_simple-module__vMXMy [data-menu-index='1'] h3,.index-module_simple-module__vMXMy [data-menu-index='1'] h4,.index-module_simple-module__vMXMy [data-menu-index='1'] h5,.index-module_simple-module__vMXMy [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__vMXMy [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_guides-section__3yADv {
  margin: 0 20px;
  overflow: hidden;
  padding: 0 0 20px;
  margin: 32px 0 0;
  background-color: #f5f6f9;
}
.index-module_guides-section__3yADv .vip-tag {
  position: relative;
  margin-left: 8px;
  background: url('data:image/png;base64,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') center / 1.375rem 0.875rem no-repeat;
}
.index-module_guides-section__3yADv .vip-tag::after {
  display: inline-block;
  width: 1.6875rem;
  content: '';
}
.index-module_guides-section__3yADv .vip-plus-tag {
  position: relative;
  margin-left: 8px;
  background: url('data:image/png;base64,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') center / 3.875rem 1rem no-repeat;
}
.index-module_guides-section__3yADv .vip-plus-tag::after {
  display: inline-block;
  width: 3.9375rem;
  content: '';
}
.index-module_guides-section__3yADv .more-title h1,.index-module_guides-section__3yADv .more-title h2,.index-module_guides-section__3yADv .more-title h3,.index-module_guides-section__3yADv .more-title h4,.index-module_guides-section__3yADv .more-title h5,.index-module_guides-section__3yADv .more-title h6 {
  position: relative;
  margin: 0;
  color: #333;
  font-weight: 500;
}
.index-module_guides-section__3yADv .more-title h1::before,.index-module_guides-section__3yADv .more-title h2::before,.index-module_guides-section__3yADv .more-title h3::before,.index-module_guides-section__3yADv .more-title h4::before,.index-module_guides-section__3yADv .more-title h5::before,.index-module_guides-section__3yADv .more-title h6::before {
  display: inline-block;
  margin-right: 4px;
  vertical-align: text-bottom;
  content: '.';
}
.index-module_guides-section__3yADv .more-title h1 *,.index-module_guides-section__3yADv .more-title h2 *,.index-module_guides-section__3yADv .more-title h3 *,.index-module_guides-section__3yADv .more-title h4 *,.index-module_guides-section__3yADv .more-title h5 *,.index-module_guides-section__3yADv .more-title h6 * {
  display: inline;
}
.index-module_guides-section__3yADv .more-title p,
.index-module_guides-section__3yADv .more-title div {
  margin-top: 0;
}
.index-module_guides-section__3yADv .more-link {
  font-weight: 400;
  position: relative;
  box-sizing: content-box;
  display: -webkit-box;
  padding-right: 12px;
  margin: 12px 0;
  overflow: hidden;
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #333;
  text-decoration: none;
  text-overflow: ellipsis;
  vertical-align: middle;
  background-color: #f5f6f9;
  border-color: transparent;
  border-style: solid;
  border-width: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.index-module_guides-section__3yADv .more-link::before {
  position: relative;
  z-index: 99;
  box-sizing: border-box;
  width: 2.875rem;
  height: 0.875rem;
  padding: 1px 3px;
  margin-right: 11px;
  font-size: 0.625rem;
  line-height: 0.875rem;
  color: #7753ff;
  vertical-align: middle;
  background-color: #fff;
  border-radius: 0.25rem;
  font-weight: 500;
}
.index-module_guides-section__3yADv .more-link::after {
  position: absolute;
  top: 50%;
  right: 0;
  display: block;
  float: right;
  width: 0.375rem;
  height: 0.625rem;
  margin-right: 0;
  content: '';
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAHJb+yRAAAABGdBTUEAALGPC/xhBQAAAl9JREFUOBGFlM2LE0EQxacnDggeArl6MYecwyb5DzwJCgui4Ap+IagogpKDCCu66kEW8QN2PQQXVlaFPejBi4cFLx7z8Yd4FhTdxN/r6e7tmQyxIenq915VV9XUTJLEazgcztIYyO3ZbGbmUcSDhL9vlkJTk/u8DiQQMkaj0SerGo/HF2J5Op1Ot4PUMwI8GLIA+IPgkBVxuOoVumo5HERz+GFl7s8AnMHe1bnb7abGmELW8SWB6PV6AQ+Gi5hQ0T71285JONdCyDuR+GWIQC4rEO8d+QHv87INvTlOO/bswZivJHrCiQ42vAcHp6KVQv4FUmfeFKn8pCR3HHEd0auyKCWZS4DPHXGbMtdjka+3n6bpPRGU2Uf01ItCmQKo6AoVvZVNyx9S0aOCQAR5LLN9ls26XyUoPJNCq7l7mjvmT1Z2ELiHZCNyd80/9ppU3Kt5sjZkBrkvXCvF8xe7HbZ6vX4YUp0NS1csudORVqv1OzDOsHdS/zkatKNBIcKg0+lc8zmUHcpnQwpytLMRkwTYIN9bMVZl2wwIoEAbCG6URQR6QaC7Zdyfqx7EGuSqF0T7MwbHzkOEJXMBPElGSv+1svOY2x8T6IHHyqTHw64GM2DvAPLvgmOYzlWa/eS/AaRnEPpshTkXTn/WFwbAUU3dlDheOG7S2JvCKgPgeBHRluYidsTexvEyXJj4QgAc9R37yM/OrXfGYZd6V9jDDHvONoaOn+Q2fYQzT2jH4Qv4aW7Vy1C5zGQyOUaXvyM86hU47jUajVPNZlMvysIVSiCLLkHWsiw72263fy70ish/1kUOgTMTIBQAAAAASUVORK5CYII=') right center / contain no-repeat;
  transform: translateY(-50%);
}
.index-module_guides-section__3yADv .icon-dui_roundinfo {
  margin-left: 8px;
  font-size: 1.25rem;
  color: #999;
  font-weight: 400;
}
.index-module_guides-section__3yADv:nth-last-child(1) {
  margin-bottom: 0;
}
.index-module_guides-section__3yADv .index-module_title__KOMEE {
  margin: 0 20px;
}
.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w {
  margin: 0;
}
.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w > h1,.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w > h2,.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w > h3,.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w > h4,.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w > h5,.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w > h6 {
  padding: 20px 0 0;
}
.index-module_guides-section__3yADv .index-module_guides-wrapper__umD3w .index-module_guides-container__95uZF {
  position: relative;
  margin: 8px 8px 0;
  list-style-type: none;
  background-color: #fff;
  border-radius: 0.75rem;
}
`,Yn={"simple-module":"index-module_simple-module__vMXMy","guides-section":"index-module_guides-section__3yADv",title:"index-module_title__KOMEE","guides-wrapper":"index-module_guides-wrapper__umD3w","guides-container":"index-module_guides-container__95uZF"};ve(nr);var tr=function(e){var n=e.guides;return(n==null?void 0:n.length)?l.a.createElement("section",{className:I()(Yn["guides-section"],"dxy-comment-disabled")},l.a.createElement("div",{className:Yn["guides-wrapper"],"data-menu-index":"1"},l.a.createElement("h2",{className:Yn.title},"\u76F8\u5173\u6307\u5357"),l.a.createElement("div",{className:Yn["guides-container"]},n.map(function(i){return l.a.createElement(er,{guide:i,key:i.id})})))):null},ir=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_simple-module__cpbi8 .ck-content p,.index-module_simple-module__cpbi8 .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__cpbi8 [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__cpbi8 [data-menu-index='1'] h1,.index-module_simple-module__cpbi8 [data-menu-index='1'] h2,.index-module_simple-module__cpbi8 [data-menu-index='1'] h3,.index-module_simple-module__cpbi8 [data-menu-index='1'] h4,.index-module_simple-module__cpbi8 [data-menu-index='1'] h5,.index-module_simple-module__cpbi8 [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__cpbi8 [data-menu-index='4'] {
  margin-top: 8px;
}
.index-module_container__tol-5 {
  position: relative;
  margin-bottom: 12px;
  overflow: hidden;
}
.index-module_container__tol-5 .index-module_wrapper__PmH16 {
  position: sticky;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10;
}
.index-module_mask-top__TelK0 {
  position: sticky;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  background: linear-gradient(0deg, rgba(255, 255, 255, 0) -0.43%, #FFF 95.52%);
}
`,jn={"simple-module":"index-module_simple-module__cpbi8",container:"index-module_container__tol-5",wrapper:"index-module_wrapper__PmH16","mask-top":"index-module_mask-top__TelK0"};ve(ir);var rr=function(e,n){var i=e.maskNode,t=e.children,r=e.onWrapperClick,a=e.className,d=e.wrapperClassName,s=e.addTopMask,u=s===void 0?!0:s,c=e.selector,m=e.selector1,f=e.minHeight,v=e.maxHeight,A=Object(p.useState)(!0),g=A[0],y=A[1],x=Object(p.useMemo)(function(){if(typeof g=="boolean"||!v&&!f)return{};if(f)return{minHeight:f+1};if(v)return{maxHeight:v+1}},[g,v,f]),j=Object(p.useRef)(null),R=Object(p.useRef)(null),Z=Object(p.useRef)(null);return Object(p.useImperativeHandle)(n,function(){return{toggleExpand:function(K){y(!K)}}},[y]),Object(p.useLayoutEffect)(function(){var W=document.createElement("div");W.classList.add(jn["mask-top"],"dxy-comment-disabled");var K=function(){var Y;j.current&&((Y=W.parentElement)===null||Y===void 0?void 0:Y.isEqualNode(j.current))&&j.current.removeChild(W)},D=function(){window.requestAnimationFrame(function(){if(j.current&&R.current){K();var Y=R.current.clientHeight;j.current.style.maxHeight="".concat((v||0)+Y,"px"),j.current.style.minHeight="".concat((f||0)+Y,"px");var H=null,k=0;if(c&&(H=document.querySelectorAll(c)),!(H==null?void 0:H.length)&&m&&(H=document.querySelectorAll(m)),H==null?void 0:H.length){var b=Array.from(H).map(function(G){return G.getBoundingClientRect()});b.length&&(k=Math.min.apply(Math,b.map(function(G){return G.top})))}var M=document.documentElement.scrollTop||document.body.scrollTop,V=j.current.scrollTop,F=M+k-j.current.offsetTop+V,J=u?Math.max(0,Math.min(F,100)):0;if(u&&(W.style.height="".concat(J,"px"),j.current.prepend(W)),Z.current){var Q=Z.current.getBoundingClientRect().height;!v||v>Q-60?j.current.style.height="".concat(Q+Y-60,"px"):j.current.style.height="auto"}j.current.scrollTop=F}})};return an(at,D),an(rt,D),D(),function(){pn(at,D),pn(rt,D),K()}},[c,m,u,v,f]),l.a.createElement("div",{className:I()(jn.container,a),style:x,ref:j,"data-over-mask":!0},l.a.createElement("div",{className:jn.content,ref:Z},t),g?l.a.createElement("div",{className:I()(jn.wrapper,"dxy-comment-disabled",d),onClick:r},l.a.createElement("div",{className:jn.card,ref:R},i)):null)},It=Object(p.forwardRef)(rr);function or(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}function Dt(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}var ar=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_simple-module__nCFbQ .ck-content p,.index-module_simple-module__nCFbQ .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__nCFbQ [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__nCFbQ [data-menu-index='1'] h1,.index-module_simple-module__nCFbQ [data-menu-index='1'] h2,.index-module_simple-module__nCFbQ [data-menu-index='1'] h3,.index-module_simple-module__nCFbQ [data-menu-index='1'] h4,.index-module_simple-module__nCFbQ [data-menu-index='1'] h5,.index-module_simple-module__nCFbQ [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__nCFbQ [data-menu-index='4'] {
  margin-top: 8px;
}
.index-module_divider__5AwEW {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 20px;
}
.index-module_divider__5AwEW .index-module_line__hhZ1B {
  flex: 1;
  position: relative;
}
.index-module_divider__5AwEW .index-module_line__hhZ1B::before {
  position: absolute;
  left: 0;
  width: 100%;
  content: ' ';
  border-bottom: 1px solid #e0e0e0;
  transform: scaleY(0.33);
  bottom: 0;
}
.index-module_divider__5AwEW .index-module_middle__MvoAt {
  display: flex;
  gap: 2px;
  align-items: center;
  margin: 0 12px;
  color: #999;
}
.index-module_divider__5AwEW .index-module_middle__MvoAt .index-module_text__PDy4- {
  font-size: 0.75rem;
  line-height: 1.0625rem;
}
.index-module_divider__5AwEW .index-module_middle__MvoAt .index-module_icon__lqMpB {
  font-size: 0.75rem;
}
.index-module_container__t-Mi5 {
  margin-bottom: 0;
}
.index-module_divider__5AwEW + .index-module_container__t-Mi5 *:first-child {
  margin-top: 0;
}
/* \u4ED8\u8D39\u6A21\u5757\u975Eplus\u7528\u6237\u89C6\u56FE */
.index-module_node__8AOfh {
  margin: 0 20px;
  font-weight: 400;
}
.index-module_node__8AOfh .index-module_header__asYvA {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0 10px;
  margin: 0;
  font-size: 1rem;
  line-height: 1.375rem;
  color: #977b54;
  background: linear-gradient(177.57deg, rgba(255, 255, 255, 0.0001) -0.43%, rgba(255, 255, 255, 0.9) 30.37%, #fff 59.54%, #fff 95.52%);
}
.index-module_node__8AOfh .index-module_header__asYvA .index-module_iconarrow_right_small_ok__7R2rM {
  flex: none;
  margin-left: 4px;
  font-size: 0.5rem;
}
.index-module_node__8AOfh .index-module_card__sB8rY {
  position: relative;
  margin: 0;
  background-color: #fff;
  box-shadow: 0 -2px #fff;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY {
  padding: 16px 12px;
  margin: 0;
  background: linear-gradient(117deg, #F8E2C4 0%, #FFF6EA 100%);
  border-radius: 0.75rem;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_head__OJn-F {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_head__OJn-F .index-module_vip__RT87- {
  width: 2.5rem;
  height: 2.5rem;
  margin-right: 8px;
  background: url('data:image/png;base64,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') center / contain no-repeat;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_head__OJn-F .index-module_desc__KbpQR .index-module_name__zMtmr {
  font-size: 1rem;
  line-height: 1.375rem;
  color: #585046;
  font-weight: 500;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_head__OJn-F .index-module_desc__KbpQR .index-module_tips__EQ97y {
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #826D51;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_body__0CenV {
  border-bottom-right-radius: 0.75rem;
  border-bottom-left-radius: 0.75rem;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_body__0CenV .index-module_advantages__yucc9 {
  margin: 12px 0 16px;
  list-style: none;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_body__0CenV .index-module_advantages__yucc9 .index-module_item__oKNqI {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  margin-top: 4px;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #826D51;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_body__0CenV .index-module_advantages__yucc9 .index-module_item__oKNqI .index-module_icon__lqMpB {
  width: 1rem;
  height: 1rem;
  margin-right: 4px;
  background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAACE4AAAhOAFFljFgAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAUoSURBVHgB7Vm9cttGEN49SK7lN4A6x42oIo46g6nShZTSR24z+nOXTCKJFJOJO1GWk9ZKn1jMEwjuFKeQUlldkCcw0yWWcZtdEH/EDwmQoIpY3wxmANwd8O3d7t7uHsAtbvF+A6EidHY+s8jVNf7gQ0KqAcECv17wm/uI4AChoxH+UErZu92fbagAUwnQ2mksGFptE9EORGSLwlGAtmHo9lfdngMTYiIBhLgitQ/aIz41WJCTSQUpLUBna41nXLcgPeN9QvgJiS4NFy6v74DT6vb60iACz78FUyu+ABuo4CGrmJkY7zCd9t7xixOYlQAH26uHyVnnD9hA1N591rOhBDobjQYgbhOANdSgsLt39OJx0e8UEsDTdRdPEz9zeLYflSWehAhCCg/jK8IGf+kqqgcrOAoKCsDQeBYnz0Z7pA1anpa8gL/R04qWieAo+j7UZMKKjB+7Akm1YfLt/We9FswA7Y1GCxH3wxcF1MkY1Xiw2VjnpX0SPM+SvMB+dWVbD+6xDGgNfggr9Y/u/3326vV53pjcFWC9NxWrTqCbojZMvhK3OQ7tjWaX7WDbf+yzui7m2UOuDSiX/XxkWA7NQQtuCDRHLZCde4DBnpODzBXwZt/FP8NORE0xNrhBsHeyCFkDfPAq3M1ahcwV8Gbfh/j5myYvEA/n7TEBD60y1XcuczSSxeozgKGOYEaI2RnMG1RPhRLsNMA3aNYCsYlW8hupFZCoMq77u91fZjL7CSdhvtVqPdnH32cCtVkQtUr2SQmgtbaiRrRhBkh6OIZzR+mTrL4SX0X3qpZsTwmgCJbCAQb+ChXjuy8aNXYQF3HymerjQ4LDkA+waieQNmIiM7h1wXWgQgh51/A8SxDJjiQvkMg2uGejXkq2pwTgJTNjjw7k4GBzdYevdSiIScgLJCyPPaaSpiw3GnbK2/28EAPokK/nXqwEsyGfwaGQAOXAgd63W2uf5zVPQ74IsgQIJZY8IGvQ3nHvBAFD96pJd79nz5Lsl0G+b7jULEM+waHAToxDnUzIgWvoR/F45drFs/jPcsjXv/6xdwklIKloSA3TNpkSAAnDH3BIkfK7AUQ3jXfUhGhWzDlXHVZJXqCVYYb3BH/BOAF4V38Z3kt9ZwQGhChMODTQemereVEVeZ/Dp+ED4uVYAZB05HcJco0zgNhDMh2Eisj7JKzgVmltp5qzxhxsNt8EJHgnrBfJfWXmffIBpibf2VhrEOogN3b2jk8Xk30y3SjH4VEEGs9RR4CrCM0g/JWqwtQz731Ib0dEs+OyvIRmgeOVN2GngqtQJTo7PPtuOPsSbi9mud/MFRAPM6TXiM/z9oRZQP5FWoc7vJQe8/aO3J3Yy0tjLnJUXlo1vH/FolWpm+b1zS2r2OdX/9Q/vPcvK/Qn3gsucXy8ch/Ofnv9EmaIztYqk6cvozf4+Junp3Ze/5F1obPfr86tBx/cZaNc8V9ZsxRCyHP5phU8D0o5p09GjSlUG+1sNodKi1Ix06jbRWqXRZBVrhdPtvv0dHnc2ELRqGuwi8QosZAfSVYlngKmhOTgnF5eDJFnDZbibpHxpcrriYpZ+DOpXJRN/r3igevuJ8vrZSuApQ84vGRGNreMAwrZbCSPVqCca7gePuCAedN13Rqv+RLP9jpkHJDw+/beD70ulMCkR0wmvkOuJI+PlYpAZl1Kl5PY1LSHfANBso+MxqHvE+9O4wyqO2blopNWyvLKMkgmDQQKo1JJlCTXkHBdIt6bDk1ucYv/K/4DyZaskBoMe8MAAAAASUVORK5CYII=') center / contain no-repeat;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_btn__H4uf3 {
  margin: 16px 0 0;
  text-align: center;
  background: linear-gradient(117deg, #E9CBA2 0%, #F8E2C4 100%);
  border-radius: 1.125rem;
}
.index-module_node__8AOfh .index-module_card__sB8rY .index-module_content__eErYY .index-module_btn__H4uf3 .index-module_text__PDy4- {
  position: relative;
  overflow: visible;
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 2.25rem;
  color: #2D2B29;
}
.index-module_mask__nCW84 {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  height: 100PX;
  pointer-events: none;
  background: linear-gradient(0deg, rgba(255, 255, 255, 0) 0, #FFF 100%);
}
`,ie={"simple-module":"index-module_simple-module__nCFbQ",divider:"index-module_divider__5AwEW",line:"index-module_line__hhZ1B",middle:"index-module_middle__MvoAt",text:"index-module_text__PDy4-",icon:"index-module_icon__lqMpB",container:"index-module_container__t-Mi5",node:"index-module_node__8AOfh",header:"index-module_header__asYvA",iconarrow_right_small_ok:"index-module_iconarrow_right_small_ok__7R2rM",card:"index-module_card__sB8rY",content:"index-module_content__eErYY",head:"index-module_head__OJn-F",vip:"index-module_vip__RT87-",desc:"index-module_desc__KbpQR",name:"index-module_name__zMtmr",tips:"index-module_tips__EQ97y",body:"index-module_body__0CenV",advantages:"index-module_advantages__yucc9",item:"index-module_item__oKNqI",btn:"index-module_btn__H4uf3",mask:"index-module_mask__nCW84"};ve(ar);var Lt=function(e){var n=e.items,i=e.userInfo,t=e.userProStatTrialInfo,r=e.fieldId,a=e.fieldName,d=e.btnText,s=e.directBuy,u=e.onTopClick,c=e.onBottomClick,m=Object(p.useRef)(null),f=Object(p.useCallback)(function(){n.length&&or({data:{pageName:"app_p_indication_detail_info",event_id:"app_e_expose_upgrade_to_svip",logType:"app_e",object_id:"".concat(r),object_name:a,ext:{button_description:d||"",purchase_method:(t==null?void 0:t.product)?s?"2":"1":"3"}}})},[r,a,n,d,t]);return Tt(m,f),l.a.createElement("div",{className:I()(ie.node,"dxy-comment-disabled"),ref:m,id:"vipNode"},l.a.createElement("div",{className:ie.header,onClick:u},l.a.createElement("span",null,(t==null?void 0:t.topDiscountInfoDesc)||(i.userName&&i.upgradeEligibility?"1 \u5143\u7279\u60E0\u5347\u7EA7\uFF0C\u89E3\u9501\u5168\u90E8\u5185\u5BB9":i.trialEligibility?"\u67E5\u770B\u5B8C\u6574\u5185\u5BB9\uFF0C\u8BF7\u8BD5\u7528\u4F1A\u5458":i.vipLevel===et.VIP?"\u5347\u7EA7\u4F1A\u5458\uFF0C\u89E3\u9501\u5168\u90E8\u5185\u5BB9":"\u5F00\u901A\u4F1A\u5458\uFF0C\u89E3\u9501\u5168\u90E8\u5185\u5BB9")),l.a.createElement("i",{className:I()("iconfont icon-arrow_right_small_ok",ie.iconarrow_right_small_ok)})),l.a.createElement("div",{className:I()(ie.card)},l.a.createElement("div",{className:I()(ie.content)},l.a.createElement("div",{className:ie.head},l.a.createElement("div",{className:ie.vip}),l.a.createElement("div",{className:ie.desc},l.a.createElement("div",{className:ie.name},"\u8BCA\u7597\u65B9\u6848"),l.a.createElement("div",{className:ie.tips},"\u4E13\u4E3A\u4E2D\u56FD\u533B\u751F\u6253\u9020\u7684\u75BE\u75C5\u8BCA\u7597\u77E5\u8BC6\u5E93"))),l.a.createElement("div",{className:ie.body},l.a.createElement("ul",{className:ie.advantages},l.a.createElement("p",{className:ie.item},l.a.createElement("span",{className:ie.icon}),l.a.createElement("span",null,"\u8986\u76D6 4000+ \u75BE\u75C5\u4E0E\u836F\u7269\u4E13\u9898\uFF0C\u5185\u5BB9\u6301\u7EED\u66F4\u65B0")),l.a.createElement("p",{className:ie.item},l.a.createElement("span",{className:ie.icon}),l.a.createElement("span",null,"\u51DD\u805A\u56FD\u5185\u5916\u6743\u5A01\u6307\u5357\u3001\u6587\u732E\u53CA\u4E34\u5E8A\u5FAA\u8BC1\u8BC1\u636E")),l.a.createElement("p",{className:ie.item},l.a.createElement("span",{className:ie.icon}),l.a.createElement("span",null,"\u8054\u5408\u884C\u4E1A\u6743\u5A01\u4E13\u5BB6\u3001\u8D44\u6DF1\u533B\u5E08\u836F\u5E08\u5171\u540C\u7F16\u5BA1"))),d?l.a.createElement("div",{className:ie.btn,onClick:c},l.a.createElement("span",{className:ie.text},d)):null))))},dr=function(e){var n=e.items,i=e.userInfo,t=e.userProStatTrialInfo,r=e.fieldId,a=e.fieldName,d=e.anchorPoint,s=e.anchorSummary,u=e.directBuy,c=e.selector,m=e.selector1,f=Object(p.useMemo)(function(){return(t==null?void 0:t.bottomDiscountInfoDesc)?t==null?void 0:t.bottomDiscountInfoDesc:(i==null?void 0:i.userName)?(i==null?void 0:i.upgradeEligibility)?"1 \u5143\u5347\u7EA7\u4E3A PLUS \u4F1A\u5458\u67E5\u770B":(i==null?void 0:i.trialEligibility)?"\u514D\u8D39\u8BD5\u7528 ".concat(i.shareTrialDays," \u5929\u4F1A\u5458"):(i==null?void 0:i.discountText)?i.discountText:"":"\u767B\u5F55\u67E5\u770B\u4F1A\u5458\u798F\u5229"},[t,i]),v=Object(p.useCallback)(function(){return C(void 0,void 0,void 0,function(){var y,x,j;return X(this,function(R){switch(R.label){case 0:return i.upgradeEligibility?(_.daTrackEvent({pageName:"app_p_indication_detail_info",eventId:"app_e_click_upgrade_to_svip",objectId:"".concat(r),objectName:a}),[4,_.getMobileOrigin()]):[3,2];case 1:return y=R.sent(),[2,_.redirectCommon({type:re.WEB,url:"".concat(y,"/h5/upgradeV2"),enableShare:!1})];case 2:return x=function(W){switch(W){case 13:case 14:return 11;default:return 12}},j=x(i.discountType),[2,_.redirectMemberDetail({entrance:i.trialEligibility?mn.FREE:mn.MASK,vipType:j})]}})})},[i,r,a]),A=Object(p.useCallback)(function(y){return C(void 0,void 0,void 0,function(){return X(this,function(x){return y.stopPropagation(),Dt({data:{pageName:"app_p_indication_detail_info",event_id:"app_e_click_goto_pro_new",object_id:"".concat(r),object_name:a,logType:"app_e",ext:{entrance:mn.MASK,button_description:f,purchase_method:(t==null?void 0:t.product)?u?"2":"1":"3"}}}),(t==null?void 0:t.topDiscountInfoUrl)?[2,_.redirectCommon({type:re.WEB,url:t.topDiscountInfoUrl})]:u&&(t==null?void 0:t.product)?[2,_.redirectPay(h({fieldId:r,fieldName:a},t.product))]:[2,v()]})})},[v,i,u,r,a,t,f]),g=Object(p.useCallback)(function(y){return C(void 0,void 0,void 0,function(){return X(this,function(x){return y.stopPropagation(),Dt({data:{pageName:"app_p_indication_detail_info",event_id:"app_e_click_goto_pro_new",object_id:"".concat(r),object_name:a,logType:"app_e",ext:{entrance:mn.MASK,button_description:f,purchase_method:(t==null?void 0:t.product)?u?"2":"1":"3"}}}),(t==null?void 0:t.bottomDiscountInfoUrl)?[2,_.redirectCommon({type:re.WEB,url:t.bottomDiscountInfoUrl})]:u&&(t==null?void 0:t.product)?[2,_.redirectPay(h({fieldId:r,fieldName:a},t.product))]:[2,v()]})})},[v,i,u,r,a,t,f]);return s?l.a.createElement(l.a.Fragment,null,n==null?void 0:n.map(function(y){return l.a.createElement(Kn,{key:y.property,item:y,reserve:!0})}),l.a.createElement("div",{className:I()(ie.divider,"dxy-comment-disabled"),onClick:A},l.a.createElement("div",{className:ie.line}),l.a.createElement("div",{className:ie.middle},l.a.createElement("span",{className:ie.text},"\u4F1A\u5458\u5185\u5BB9\u5DF2\u6298\u53E0\uFF0C\u5F00\u901A\u540E\u53EF\u67E5\u770B"),l.a.createElement("i",{className:I()("iconfont icon-arrowdown",ie.icon)})),l.a.createElement("div",{className:ie.line})),l.a.createElement(It,{className:ie.container,maxHeight:340,onWrapperClick:g,selector:c,selector1:m,addTopMask:!1,maskNode:l.a.createElement(Lt,{items:n,userInfo:i,fieldId:r,fieldName:a,userProStatTrialInfo:t,btnText:f,onTopClick:A,onBottomClick:g,directBuy:u})},l.a.createElement(Kn,{anchorPoint:d,item:{content:s,property:"",removeTitleSummary:!0,haveMarker:!1,readDisabled:!0},tableWrapperProps:{allowFullscreen:!1}}))):l.a.createElement(It,{className:ie.container,maxHeight:340,onWrapperClick:g,selector:c,selector1:m,maskNode:l.a.createElement(Lt,{items:n,userInfo:i,fieldId:r,fieldName:a,userProStatTrialInfo:t,btnText:f,onTopClick:A,onBottomClick:g,directBuy:u})},n==null?void 0:n.map(function(y){return l.a.createElement(Kn,{key:y.property,item:y,anchorPoint:d})}))},lr=`.index-module_simple-module__q4uFD .ck-content p,.index-module_simple-module__q4uFD .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__q4uFD [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__q4uFD [data-menu-index='1'] h1,.index-module_simple-module__q4uFD [data-menu-index='1'] h2,.index-module_simple-module__q4uFD [data-menu-index='1'] h3,.index-module_simple-module__q4uFD [data-menu-index='1'] h4,.index-module_simple-module__q4uFD [data-menu-index='1'] h5,.index-module_simple-module__q4uFD [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__q4uFD [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_toast__sK43z .adm-toast-main-text {
  padding: 16px 20px;
  background-color: rgba(0, 0, 0, 0.8);
  border-radius: 0.75rem;
}
.index-module_toast__sK43z .index-module_content__CjhHQ {
  font-size: 0.875rem;
  line-height: 1.5rem;
  color: #fff;
  text-align: center;
}
.index-module_section__3-1Up[data-menu-index] {
  padding: 12px 0 0;
  margin: 0 20px;
  -webkit-user-select: text;
     -moz-user-select: text;
          user-select: text;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B {
  box-sizing: border-box;
  padding: 12px;
  margin: 0;
  position: relative;
  border-radius: 0.75rem;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B::before {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  width: 200%;
  height: 200%;
  pointer-events: none;
  content: ' ';
  border: 1px solid #1ba6a9;
  border-radius: 1.5rem;
  transform: scale(0.5) translate(-1px, -1px);
  transform-origin: 0 0;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_header__-MUrv {
  display: flex;
  justify-content: space-between;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_header__-MUrv .index-module_title__-VrIm {
  font-size: 1rem;
  line-height: 1.375rem;
  color: #1ba6a9;
  font-weight: 500;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_header__-MUrv .index-module_action__wJd-d {
  display: flex;
  flex: none;
  align-items: center;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_header__-MUrv .index-module_action__wJd-d .index-module_btn__8ocI- {
  font-size: 0.875rem;
  line-height: 1.25rem;
  color: #7753ff;
  font-weight: 500;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_header__-MUrv .index-module_action__wJd-d .index-module_checked__5eIPw {
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: #999;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_header__-MUrv .index-module_action__wJd-d .index-module_add__zUCtF {
  color: #7753ff;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ {
  padding-bottom: 12px;
  margin-top: 12px;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ:last-child {
  padding-bottom: 4px;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ figure > p,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ figure > div {
  margin-top: 0;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ > *:first-child {
  margin-top: 4px;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ p,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ div {
  margin-top: 12px;
  font-size: 1rem;
  line-height: 1.75rem;
  color: #333;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ h1,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ h2,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ h3,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ h4,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ h5,.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_content__CjhHQ h6 {
  margin-top: 12px;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_more__zDdkX {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  font-size: 0.75rem;
  line-height: 1.125rem;
  color: #999;
  position: relative;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_more__zDdkX::before {
  position: absolute;
  left: 0;
  width: 100%;
  content: ' ';
  border-bottom: 1px solid #e0e0e0;
  transform: scaleY(0.33);
  top: 0;
}
.index-module_section__3-1Up[data-menu-index] .index-module_card__u2B4B .index-module_more__zDdkX .index-module_iconarrow_right_small_ok__aQInl {
  flex: none;
  margin-left: 4px;
  font-size: 0.5rem;
  color: #cccccc;
}
`,ge={"simple-module":"index-module_simple-module__q4uFD",toast:"index-module_toast__sK43z",content:"index-module_content__CjhHQ",section:"index-module_section__3-1Up",card:"index-module_card__u2B4B",header:"index-module_header__-MUrv",title:"index-module_title__-VrIm",action:"index-module_action__wJd-d",btn:"index-module_btn__8ocI-",checked:"index-module_checked__5eIPw",add:"index-module_add__zUCtF",more:"index-module_more__zDdkX",iconarrow_right_small_ok:"index-module_iconarrow_right_small_ok__aQInl"};ve(lr);var ur=function(e){var n=e.id,i=e.name,t=e.updateRecord,r=Ge(e,["id","name","updateRecord"]),a=Object(p.useState)(!!r.hasSubscribe),d=a[0],s=a[1],u=Object(p.useState)(!!r.canSubscribe),c=u[0],m=u[1],f=Object(p.useMemo)(function(){return Hn()},[]);return Object(p.useEffect)(function(){if(n&&t&&f){var v=_.addEventListener("onShow",function(){return C(void 0,void 0,void 0,function(){return X(this,function(A){return _.getDiseaseSubscription({id:n,name:i}).then(function(g){var y,x;g.success&&(s(!!((y=g.data)===null||y===void 0?void 0:y.hasSubscribe)),m(!!((x=g.data)===null||x===void 0?void 0:x.canSubscribe)))}),[2]})})});return function(){v()}}return tt},[n,i,t,f]),t?l.a.createElement("section",{className:ge.section,"data-menu-index":"1"},l.a.createElement("h2",{"data-header-text":"\u66F4\u65B0\u8981\u70B9",style:{display:"none"}}),l.a.createElement("div",{className:I()(ge.card,"dxy-card")},l.a.createElement("div",{className:ge.header},l.a.createElement("h2",{className:ge.title},Vt(t.publishDate)," \u66F4\u65B0\u8981\u70B9"),f?l.a.createElement("div",{className:I()(ge.action,"dxy-comment-disabled"),onClick:function(){!d&&c?_.subscribeDisease({id:n,name:i}).then(function(A){A.success?(s(!0),Ae.c.show({maskClassName:ge.toast,content:l.a.createElement("div",{className:ge.content},l.a.createElement("p",null,"\u8BA2\u9605\u6210\u529F"),l.a.createElement("p",null,"\u4F60\u5C06\u6536\u5230\u8BCA\u7597\u65B9\u6848\u66F4\u65B0\u63D0\u9192"))})):Ae.c.show({maskClassName:ge.toast,content:l.a.createElement("div",{className:ge.content},l.a.createElement("p",null,A.message||"\u8BA2\u9605\u5931\u8D25"))})}):_.redirectSubscription({id:n,name:i})}},d||!c?l.a.createElement(l.a.Fragment,null,l.a.createElement("span",{className:I()(ge.btn,ge.checked)},d?"\u5DF2\u8BA2\u9605":"\u8BA2\u9605\u7BA1\u7406"),l.a.createElement("i",{className:I()("iconfont icon-dui_page_arrow",ge.arrow,ge.checked)})):l.a.createElement(l.a.Fragment,null,l.a.createElement("i",{className:I()("iconfont","icon-page_add",ge.add)}),l.a.createElement("span",{className:ge.btn},"\u8BA2\u9605\u66F4\u65B0"))):null),l.a.createElement(Un,{className:ge.content,dangerouslySetInnerHTML:{__html:t.content},transformNode:!0,counter:!0}),t.hasMore?l.a.createElement("div",{className:ge.more,onClick:function(){_.redirectUpdateRecord(2)}},l.a.createElement("span",null,"\u67E5\u770B\u5386\u53F2\u66F4\u65B0"),l.a.createElement("i",{className:I()("iconfont","icon-arrow_right_small_ok",ge.iconarrow_right_small_ok)})):null)):null};function sr(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}function cr(o){return C(this,void 0,void 0,function(){return X(this,function(e){return[2,Ue(h({url:"/_da_app",method:"POST"},o))]})})}var mr=`.index-module_simple-module__zirh1 .ck-content p,.index-module_simple-module__zirh1 .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.index-module_simple-module__zirh1 [data-menu-index='1'] {
  margin-top: 24px;
}
.index-module_simple-module__zirh1 [data-menu-index='1'] h1,.index-module_simple-module__zirh1 [data-menu-index='1'] h2,.index-module_simple-module__zirh1 [data-menu-index='1'] h3,.index-module_simple-module__zirh1 [data-menu-index='1'] h4,.index-module_simple-module__zirh1 [data-menu-index='1'] h5,.index-module_simple-module__zirh1 [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.index-module_simple-module__zirh1 [data-menu-index='4'] {
  margin-top: 8px;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.index-module_tips__IypTk {
  position: fixed;
  right: 0;
  left: 0;
  z-index: 9;
  height: 29PX;
  padding: 0 20px;
  background-color: #fff;
  box-shadow: 0 -1PX #fff;
}
.index-module_tips__IypTk .index-module_menu__N9Gly {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-start;
  height: 1.0625rem;
  overflow: hidden;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #999;
}
.index-module_tips__IypTk .index-module_menu__N9Gly .index-module_pre__YjTNt {
  flex: 0 1000 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.index-module_tips__IypTk .index-module_menu__N9Gly .index-module_character__usgo7 {
  margin: 0 2px;
  font-size: 0.75rem;
}
.index-module_tips__IypTk .index-module_menu__N9Gly .index-module_character__usgo7.index-module_gt__lBg57 {
  flex: none;
}
.index-module_tips__IypTk .index-module_menu__N9Gly .index-module_container__5OW3R {
  flex: 0 0 auto;
  max-width: calc(100% - 2.5rem);
}
.index-module_tips__IypTk .index-module_menu__N9Gly .index-module_container__5OW3R .index-module_anchor__pjjzB {
  color: #7753ff;
  display: -webkit-box;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 1;
  /*! autoprefixer: off */
  -webkit-box-orient: vertical;
  font-weight: 500;
}
.index-module_tips__IypTk .index-module_menu__N9Gly sub {
  position: static;
  vertical-align: sub;
}
.index-module_tips__IypTk .index-module_menu__N9Gly sup {
  position: static;
  vertical-align: super;
}
`,$e={"simple-module":"index-module_simple-module__zirh1",tips:"index-module_tips__IypTk",menu:"index-module_menu__N9Gly",pre:"index-module_pre__YjTNt",character:"index-module_character__usgo7",gt:"index-module_gt__lBg57",container:"index-module_container__5OW3R",anchor:"index-module_anchor__pjjzB"};ve(mr);var Nn="&__&",Wt=function(e){var n,i,t,r=(n=e.title)===null||n===void 0?void 0:n.replace(/<\/?su[p|b]>/gi,""),a=(i=e.cellId)===null||i===void 0?void 0:i.lastIndexOf(Nn),d=(t=e.cellId)===null||t===void 0?void 0:t.slice(a!==-1?a+Nn.length:0),s=r.lastIndexOf(d);return s!==-1?e.title.slice(s):e.title},vr=function(e,n){var i=e.details,t=e.menus,r=e.fieldId,a=e.fieldName,d=e.top,s=e.height,u=Object(p.useState)(""),c=u[0],m=u[1],f=Object(p.useRef)(!1),v=Object(p.useRef)(null),A=Object(p.useMemo)(function(){var j=new Map;if(t==null?void 0:t.length)for(var R=function(D,ee){var Y=t[D];if(Y.cellId.includes(Nn))for(var H=D-1;H>-1;H--){var k=t[H];if(Y.cellId.indexOf(k==null?void 0:k.cellId)===0){var b=j.get(k.cellId);b&&j.set(Y.cellId,Wn(Wn([],b||[],!0),[Wt(Y)],!1));break}}else(i==null?void 0:i.some(function(M){return M.property===Y.title}))&&j.set(Y.cellId,[Wt(Y)])},Z=0,W=t==null?void 0:t.length;Z<W;Z++)R(Z,W);return j},[t,i]),g=Object(p.useMemo)(function(){if(!c)return{path:[],anchor:""};var j=[];if(c.includes(Nn))j=A.get(c);else{var R=t==null?void 0:t.find(function(Z){return Z.cellId.indexOf("".concat(c).concat(Nn))===0});R&&(j=A.get(R.cellId))}return(j==null?void 0:j.length)?{path:j==null?void 0:j.slice(0,-1),anchor:j==null?void 0:j[j.length-1]}:{path:[],anchor:""}},[c,A,t]),y=g.path,x=g.anchor;return Object(p.useImperativeHandle)(n,function(){return{getElement:function(){return v.current}}},[]),Object(p.useEffect)(function(){return an(ot,m),function(){pn(ot,m)}},[]),Object(p.useEffect)(function(){(y==null?void 0:y.length)&&x&&!f.current&&(f.current=!0,cr({data:{event_id:"app_e_expose_top_index_info",pageName:"app_p_indication_detail_info",logType:"app_e",object_id:"".concat(r),object_name:a}}))},[y,x,r,a]),(y==null?void 0:y.length)&&x?l.a.createElement("div",{className:I()($e.tips,"dxy-comment-disabled"),style:{top:d,height:s},onClick:function(){sr({data:{event_id:"app_e_click_top_index_info",pageName:"app_p_indication_detail_info",logType:"app_e",object_id:"".concat(r),object_name:a}}),_.openMenuModal()},ref:v},l.a.createElement("div",{className:$e.menu},l.a.createElement("div",{className:$e.pre},y.map(function(j,R){return l.a.createElement(l.a.Fragment,{key:R},R!==0?l.a.createElement("i",{className:I()("iconfont icon-dui_page_arrow",$e.character)}):null,l.a.createElement("span",{dangerouslySetInnerHTML:{__html:j}}))})),l.a.createElement("i",{className:I()("iconfont icon-dui_page_arrow",$e.character,$e.gt)}),l.a.createElement("div",{className:$e.container},l.a.createElement("span",{className:$e.anchor,dangerouslySetInnerHTML:{__html:x}})))):null},fr=Object(p.forwardRef)(vr),pr=function(e){var n,i=e.children,t=Ge(e,["children"]),r=t.href,a=Ge(t,["href"]),d=Object(p.useMemo)(function(){return vn()},[]);return d&&(r&&/^https?:\/\//.test(r)||((n=t==null?void 0:t.className)===null||n===void 0?void 0:n.includes("J-redirect")))?l.a.createElement("span",null,i):r&&/^https?:\/\//.test(r)?l.a.createElement("a",h({},a,{onClick:function(u){_.redirectCommon({type:re.WEB,url:r}),u.stopPropagation(),u.preventDefault()}}),i):l.a.createElement("a",h({},t),i)},Ar=function(e,n){e===void 0&&(e=!1);var i=Object(p.useState)(!1),t=i[0],r=i[1],a=Object(p.useRef)(!1);return Object(p.useLayoutEffect)(function(){var d=new IntersectionObserver(function(u){for(var c=0,m=u.length;c<m;c++){var f=u[c],v=f.intersectionRatio<.5;if(v!==a.current){a.current=v,_.toggleNavigatorTitle({show:v,title:(n==null?void 0:n.title)||f.target.textContent,vip:e}),r(v);break}}},{threshold:[.01,.99]});d.POLL_INTERVAL=100;var s=T()((n==null?void 0:n.selector)||"h1").get(0);return s&&d.observe(s),function(){d.disconnect()}},[e,n]),t},hr=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.app-module_simple-module__Oz2jh .ck-content p,.app-module_simple-module__Oz2jh .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.app-module_simple-module__Oz2jh [data-menu-index='1'] {
  margin-top: 24px;
}
.app-module_simple-module__Oz2jh [data-menu-index='1'] h1,.app-module_simple-module__Oz2jh [data-menu-index='1'] h2,.app-module_simple-module__Oz2jh [data-menu-index='1'] h3,.app-module_simple-module__Oz2jh [data-menu-index='1'] h4,.app-module_simple-module__Oz2jh [data-menu-index='1'] h5,.app-module_simple-module__Oz2jh [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.app-module_simple-module__Oz2jh [data-menu-index='4'] {
  margin-top: 8px;
}
.app-module_content__CHbOK {
  flex: 1;
  background: url('data:image/png;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAyPz/xgt5VECpA08AAAAASUVORK5CYII=') top right / 5.625rem 5.9375rem no-repeat;
}
.app-module_content__CHbOK [data-menu-index] > [data-section-index]::before {
  content: none !important;
}
.app-module_content__CHbOK [data-section-index]::before {
  content: none !important;
}
.app-module_content__CHbOK [data-orderedlist-index]::before {
  content: none !important;
}
.app-module_content__CHbOK [data-orderedlist-index="4"] .dxy-ordered-node {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1em;
  height: 1em;
  margin-right: 4px;
  line-height: 1em;
  border: 1px solid #999;
  border-radius: 50%;
}
.dxy-comment-share .app-module_content__CHbOK {
  background: none;
}
.app-module_gray__ZxeAk {
  background-color: #f5f6f9;
}
.app-module_brand__PbAMJ {
  overflow: hidden;
}
.app-module_brand__PbAMJ.app-module_sticky__8j1mo {
  position: sticky;
  top: 0;
  right: 0;
  left: 0;
  z-index: 101;
  background-color: #fff;
}
.app-module_disease-card__ncvjm {
  position: relative;
  padding: 0 0 20px;
  margin-top: 12px;
  overflow: visible;
}
.app-module_disease-card__ncvjm .app-module_divider__e1fSa::after {
  position: absolute;
  right: 1.25rem;
  bottom: 0;
  left: 1.25rem;
  content: '';
  border-bottom: 1px solid #e0e0e0;
  transform: scaleY(0.33);
}
.dxy-comment-share .app-module_disease-card__ncvjm {
  padding: 0;
  margin-top: 0;
}
.dxy-comment-share .app-module_disease-card__ncvjm .app-module_divider__e1fSa::after {
  content: none;
  border-bottom: none;
}
.app-module_disease-card__ncvjm .app-module_disease-name__1SFoJ {
  margin-right: 20px;
  margin-left: 20px;
  font-size: 1.4375rem;
  font-weight: bold;
  line-height: 2.125rem;
  color: #333;
}
.app-module_disease-card__ncvjm .app-module_disease-en-name__4OMdc {
  margin: 4px 20px 0;
  font-size: 0.75rem;
  line-height: 1.0625rem;
  color: #999999;
  font-weight: 400;
}
`,en={"simple-module":"app-module_simple-module__Oz2jh",content:"app-module_content__CHbOK",gray:"app-module_gray__ZxeAk",brand:"app-module_brand__PbAMJ",sticky:"app-module_sticky__8j1mo","disease-card":"app-module_disease-card__ncvjm",divider:"app-module_divider__e1fSa","disease-name":"app-module_disease-name__1SFoJ","disease-en-name":"app-module_disease-en-name__4OMdc"};ve(hr);var br=function(e){var n=e.detail,i=n.details,t=n.literatures,r=n.fieldId,a=n.fieldName,d=n.fieldEnName,s=n.guides,u=n.userInfo,c=n.auditExperts,m=n.thankUsers,f=n.updateRecord,v=n.menus,A=n.userProStatTrialInfo,g=n.anchorSummary,y=n.anchorPoint,x=n.experimental,j=n.comments,R=n.otherComments,Z=n.shareComment,W=n.shareId,K=n.commentId,D=n.commentDisabled,ee=n.canSubscribe,Y=n.hasSubscribe,H=n.query,k=u||{},b=k.vipLevel,M=b===void 0?0:b,V=k.userName,F=k.svipIntroQualify,J=29,Q=Object(p.useRef)(null),G=Object(p.useRef)(null),oe=Object(p.useState)(0),pe=oe[0];oe[1];var ye=Object(p.useMemo)(function(){var P;return((P=A==null?void 0:A.product)===null||P===void 0?void 0:P.introProduct)&&!F?h(h({},A),{product:null}):A},[A,F]),ze=Object(p.useRef)(null),be=Object(p.useMemo)(function(){return i?i.map(function(P){var E=P.content,L=P.haveMarker;return E&&L?h(h({},P),{content:Ut(r,E)}):P}):[]},[i,r]),kn=Object(p.useMemo)(function(){return be.filter(function(P){var E=P.readDisabled;return!E})},[be]),Oe=Object(p.useMemo)(function(){var P=be.filter(function(L){var S=L.readDisabled;return S}),E=P.filter(function(L){return L.content});return E.length?E:P.slice(0,1)},[be]),de=Object(p.useMemo)(function(){if(Z)return Z;if(!D&&(x==null?void 0:x.enable_disease_search_query)&&H){var P=Nt(H);return P}},[Z,x,D,H,Oe]),xe=Object(p.useMemo)(function(){var P,E;return de&&(P='u[data-id="'.concat(de.id,'"]')),y&&(E='[data-menu-anchor="'.concat(y.replace(/"/g,'\\"'),'"]')),{selector:P,selector1:E}},[y,de]),le=xe.selector,_e=xe.selector1,Pe=Object(p.useMemo)(function(){if(y&&(D||!(x==null?void 0:x.enable_disease_search_query)||!H))return y},[y,D,x,H]),ue=Object(p.useCallback)(function(P){return P},[n]),fe=Object(p.useCallback)(function(){_.daTrackEvent({eventId:"app_e_click_reference",pageName:"app_p_indication_detail_info",objectId:"".concat(r),objectName:a})},[r,a]),N=Object(p.useCallback)(function(){return C(void 0,void 0,void 0,function(){return X(this,function(P){return[2]})})},[]);return Object(p.useEffect)(function(){var P=function(S){var z=S.key;_.daTrackEvent({pageName:"app_p_indication_info",eventId:"app_e_click_anchor",objectId:"".concat(r),userInfo:{fieldId:r,userName:V||"",vipLevel:M,title:z}})},E=function(S){var z=li(S==null?void 0:S.target);_.daTrackEvent({pageName:"app_p_indication_detail_info",eventId:"app_e_click_contextual_anchors",objectId:"".concat(r),objectName:a,userInfo:{field_name:z}})};return an(it,P),an(dt,E),function(){pn(it,P),pn(dt,E)}},[V,r,a,M]),Ar(!n.freeDayLeft),Object(p.useLayoutEffect)(function(){var P,E,L=(P=n==null?void 0:n.menus)!==null&&P!==void 0?P:Qt(((E=ze.current)===null||E===void 0?void 0:E.getMenu(!1))||[]);_.dataTransfer({menu:L})},[n]),l.a.createElement(Et.Provider,{value:{CustomLink:pr,detail:{id:r,name:a,moduleType:ae.CLINICAL}}},l.a.createElement("div",{className:en.content},l.a.createElement("div",{className:I()(en.brand,pe&&en.sticky),ref:Q},l.a.createElement(Ji,null),l.a.createElement("header",{className:I()(en["disease-card"])},l.a.createElement("h1",{className:en["disease-name"]},a),d?l.a.createElement("p",{className:I()(en["disease-en-name"],"dxy-comment-disabled")},d):null,l.a.createElement(Wi,{lastLiteratureDate:n.lastLiteratureDate,lastModifyTime:n.lastModifyTime,hasUpdateRecord:n.hasUpdateRecord}),l.a.createElement(gi,{auditExperts:c,id:r,title:a}),l.a.createElement("div",{className:I()(en.divider,"dxy-comment-disabled")}))),l.a.createElement(bi,{ref:ze,transformMenu:ue,onReady:N,showMenuIcon:!0,menus:v,diffY:J,offsetY:pe,id:n.fieldId,moduleType:ae.CLINICAL,isTrackDuration:!0,anchorPoint:Pe},l.a.createElement(fr,{ref:G,details:be,menus:v,fieldId:r,fieldName:a,top:44+pe,height:J}),l.a.createElement(ur,{id:r,name:a,updateRecord:f,hasSubscribe:Y,canSubscribe:ee}),kn.map(function(P,E){return l.a.createElement(Kn,{key:E,item:P})}),(Oe==null?void 0:Oe.length)?l.a.createElement(dr,{items:Oe,userInfo:u,fieldId:r,fieldName:a,userProStatTrialInfo:ye,anchorPoint:y,anchorSummary:g,directBuy:x==null?void 0:x.direct_buy,selector:le,selector1:_e}):null,t?l.a.createElement(di,{content:t,maxShow:1,lastLiteratureDate:n.lastLiteratureDate,onLiteratureClick:function(){_.daTrackEvent({pageName:"app_p_indication_detail_info",eventId:"app_e_click_reference_num",objectId:"".concat(r)})},onLiteratureItemClick:fe,richMode:!1}):null,l.a.createElement(Ki,{content:m}),l.a.createElement(tr,{guides:s}))),l.a.createElement(Oi,{type:"develop",className:(s==null?void 0:s.length)?en.gray:void 0}),D?null:l.a.createElement(Di,{fieldId:r,shareId:W,readable:!(Oe==null?void 0:Oe.length),fieldName:a,commentId:K,moduleType:ae.CLINICAL,comments:j,otherComments:R,shareComment:de,userInfo:u,query:(x==null?void 0:x.enable_disease_search_query)?H:void 0}))},xr=`html {
  -webkit-text-size-adjust: none;
     -moz-text-size-adjust: none;
          text-size-adjust: none;
  font-size: 1rem;
}
body {
  margin: 0;
  font-size: 1rem;
}
article,
aside,
details,
figcaption,
figure,
footer,
header,
hgroup,
main,
menu,
nav,
section,
summary {
  display: block;
}
/**
 * 1. Correct \`inline-block\` display not defined in IE 8/9.
 * 2. Normalize vertical alignment of \`progress\` in Chrome, Firefox, and Opera.
 */
audio,
canvas,
progress,
video {
  display: inline-block;
  /* 1 */
  vertical-align: baseline;
  /* 2 */
}
/**
 * Prevent modern browsers from displaying \`audio\` without controls.
 * Remove excess height in iOS 5 devices.
 */
audio:not([controls]) {
  display: none;
  height: 0;
}
/**
 * Address \`[hidden]\` styling not present in IE 8/9/10.
 * Hide the \`template\` element in IE 8/9/11, Safari, and Firefox < 22.
 */
[hidden],
template {
  display: none;
}
/* Links
   ========================================================================== */
/**
 * Remove the gray background color from active links in IE 10.
 */
a {
  background-color: transparent;
}
/* Text-level semantics
   ========================================================================== */
/**
 * Address styling not present in IE 8/9/10/11, Safari, and Chrome.
 */
abbr[title] {
  border-bottom: 1px dotted;
}
/**
 * Address style set to \`bolder\` in Firefox 4+, Safari, and Chrome.
 */
b,
strong {
  font-weight: bold;
}
/**
 * Address styling not present in Safari and Chrome.
 */
dfn {
  font-style: italic;
}
/**
 * Address variable \`h1\` font-size and margin within \`section\` and \`article\`
 * contexts in Firefox 4+, Safari, and Chrome.
 */
h1 {
  margin: 0.67em 0;
  font-size: 2em;
}
/**
 * Address styling not present in IE 8/9.
 */
mark {
  color: #000;
  background: #ff0;
}
/**
 * Address inconsistent and variable font size in all browsers.
 */
small {
  font-size: 80%;
}
/**
 * Prevent \`sub\` and \`sup\` affecting \`line-height\` in all browsers.
 */
sub,
sup {
  position: relative;
  font-size: 75%;
  line-height: 0;
  vertical-align: baseline;
}
sup {
  top: -0.5em;
}
sub {
  bottom: -0.25em;
}
/* Embedded content
   ========================================================================== */
/**
 * Remove border when inside \`a\` element in IE 8/9/10.
 */
img {
  border: 0;
}
/**
 * Correct overflow not hidden in IE 9/10/11.
 */
svg:not(:root) {
  overflow: hidden;
}
/* Grouping content
   ========================================================================== */
/**
 * Address margin not present in IE 8/9 and Safari.
 */
figure {
  margin: 1em 40px;
}
/**
 * Address differences between Firefox and other browsers.
 */
hr {
  box-sizing: content-box;
  height: 0;
}
/**
 * Contain overflow in all browsers.
 */
pre {
  overflow: auto;
}
/**
 * Address odd \`em\`-unit font size rendering in all browsers.
 */
code,
kbd,
pre,
samp {
  font-family: monospace;
  font-size: 1em;
}
/* Forms
   ========================================================================== */
/**
 * Known limitation: by default, Chrome and Safari on OS X allow very limited
 * styling of \`select\`, unless a \`border\` property is set.
 */
/**
 * 1. Correct color not being inherited.
 *    Known issue: affects color of disabled elements.
 * 2. Correct font properties not being inherited.
 * 3. Address margins set differently in Firefox 4+, Safari, and Chrome.
 */
button,
input,
optgroup,
select,
textarea {
  margin: 0;
  /* 3 */
  font: inherit;
  /* 2 */
  color: inherit;
  /* 1 */
}
/**
 * Address \`overflow\` set to \`hidden\` in IE 8/9/10/11.
 */
button {
  overflow: visible;
}
/**
 * Address inconsistent \`text-transform\` inheritance for \`button\` and \`select\`.
 * All other form control elements do not inherit \`text-transform\` values.
 * Correct \`button\` style inheritance in Firefox, IE 8/9/10/11, and Opera.
 * Correct \`select\` style inheritance in Firefox.
 */
button,
select {
  text-transform: none;
}
/**
 * 1. Avoid the WebKit bug in Android 4.0.* where (2) destroys native \`audio\`
 *    and \`video\` controls.
 * 2. Correct inability to style clickable \`input\` types in iOS.
 * 3. Improve usability and consistency of cursor style between image-type
 *    \`input\` and others.
 */
button,
html input[type="button"],
input[type="reset"],
input[type="submit"] {
  -webkit-appearance: button;
     -moz-appearance: button;
          appearance: button;
  /* 2 */
  cursor: pointer;
  /* 3 */
}
/**
 * Re-set default cursor for disabled elements.
 */
button[disabled],
html input[disabled] {
  cursor: default;
}
/**
 * Remove inner padding and border in Firefox 4+.
 */
button::-moz-focus-inner,
input::-moz-focus-inner {
  padding: 0;
  border: 0;
}
/**
 * Address Firefox 4+ setting \`line-height\` on \`input\` using \`!important\` in
 * the UA stylesheet.
 */
input {
  line-height: normal;
}
/**
 * It's recommended that you don't attempt to style these elements.
 * Firefox's implementation doesn't respect box-sizing, padding, or width.
 *
 * 1. Address box sizing set to \`content-box\` in IE 8/9/10.
 * 2. Remove excess padding in IE 8/9/10.
 */
input[type='checkbox'],
input[type='radio'] {
  box-sizing: border-box;
  /* 1 */
  padding: 0;
  /* 2 */
}
/**
 * Fix the cursor style for Chrome's increment/decrement buttons. For certain
 * \`font-size\` values of the \`input\`, it causes the cursor style of the
 * decrement button to change from \`default\` to \`text\`.
 */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  height: auto;
}
/**
 * 1. Address \`appearance\` set to \`searchfield\` in Safari and Chrome.
 * 2. Address \`box-sizing\` set to \`border-box\` in Safari and Chrome
 *    (include \`-moz\` to future-proof).
 */
input[type='search'] {
  box-sizing: content-box;
  -webkit-appearance: textfield;
     -moz-appearance: textfield;
          appearance: textfield;
  /* 1 */
  /* 2 */
}
/**
 * Remove inner padding and search cancel button in Safari and Chrome on OS X.
 * Safari (but not Chrome) clips the cancel button when the search input has
 * padding (and \`textfield\` appearance).
 */
input[type='search']::-webkit-search-cancel-button,
input[type='search']::-webkit-search-decoration {
  -webkit-appearance: none;
          appearance: none;
}
/**
 * Define consistent border, margin, and padding.
 */
fieldset {
  padding: 0.35em 0.625em 0.75em;
  margin: 0 2px;
  border: 1px solid #c0c0c0;
}
/**
 * 1. Correct \`color\` not being inherited in IE 8/9/10/11.
 * 2. Remove padding so people aren't caught out if they zero out fieldsets.
 */
legend {
  padding: 0;
  /* 2 */
  border: 0;
  /* 1 */
}
/**
 * Remove default vertical scrollbar in IE 8/9/10/11.
 */
textarea {
  overflow: auto;
}
/**
 * Don't inherit the \`font-weight\` (applied by a rule above).
 * NOTE: the default cannot safely be changed in Chrome and Safari on OS X.
 */
optgroup {
  font-weight: bold;
}
/* Tables
   ========================================================================== */
/**
 * Remove most spacing between table cells.
 */
table {
  border-spacing: 0;
  border-collapse: collapse;
}
td,
th {
  padding: 0;
}
a,
img {
  -webkit-touch-callout: none;
}
a,
div,
label,
li {
  -webkit-tap-highlight-color: transparent;
}
html {
  height: 100%;
  max-height: 100%;
  max-height: var(--visual-height, 100%);
  font-size: 62.5%;
}
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: normal;
}
button {
  background-color: transparent;
  border: none;
  outline: none;
}
input {
  -webkit-appearance: none;
     -moz-appearance: none;
          appearance: none;
  border: none;
  outline: none;
  box-shadow: none;
}
:input-placeholder {
  color: #999;
}
::-moz-placeholder {
  color: #999;
}
::placeholder {
  color: #999;
}
:input-placeholder {
  color: #999;
}
article,
aside,
blockquote,
body,
button,
code,
dd,
details,
div,
dl,
dt,
fieldset,
figcaption,
figure,
footer,
form,
h1,
h2,
h3,
h4,
h5,
h6,
header,
hgroup,
hr,
input,
legend,
li,
menu,
nav,
ol,
p,
pre,
section,
td,
textarea,
th,
ul {
  padding: 0;
  margin: 0;
  font-family: 'PingFang SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'HarmonyOS Sans', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;
  word-wrap: break-word;
}
a:active,
a:hover {
  text-decoration: none;
  outline: 0;
}
/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.simple-module :global .ck-content p,.simple-module :global .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.simple-module [data-menu-index='1'] {
  margin-top: 24px;
}
.simple-module [data-menu-index='1'] h1,.simple-module [data-menu-index='1'] h2,.simple-module [data-menu-index='1'] h3,.simple-module [data-menu-index='1'] h4,.simple-module [data-menu-index='1'] h5,.simple-module [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.simple-module [data-menu-index='4'] {
  margin-top: 8px;
}
.J-redirect {
  color: #371A97;
}
.ck-content .J-redirect {
  position: relative;
  color: #371A97;
}
.ck-content span[data-href] {
  position: relative;
  color: #371A97;
}
a[href] {
  text-decoration: none;
}
.ck-content figure.image > a::after {
  content: none;
}
.ck-content figure.image > span[data-href]::after {
  content: none;
}
.ck-content a[href^="https://app.dxy.cn/drugs/"] {
  position: relative;
  color: #371A97;
  text-decoration: none;
}
.ck-content .dxy-card {
  margin-top: 12px;
}
.ck-content .dxy-card p,.ck-content .dxy-card div {
  color: #333;
}
.ck-content .dxy-card > p,.ck-content .dxy-card > div {
  font-size: 1rem;
  line-height: 1.75rem;
}
.ck-content .dxy-card > * {
  margin-top: 12px;
}
.ck-content .dxy-card > :first-child {
  margin-top: 0;
}
.ck-content .dxy-card * {
  margin-bottom: 0;
}
.ck-content .fullscreen figcaption[type="comment"] {
  flex: 1 0.1 7.75rem;
  overflow: auto;
}
.ck-content [data-anchor-index="4"] {
  font-weight: normal;
}
sup.literature-sup {
  margin-right: 2px;
  margin-left: 2px;
  font-size: 0.75rem;
  vertical-align: text-top;
}
sup > sup.literature-sup {
  top: 0;
}
.adm-toast-mask .adm-toast-main {
  background-color: rgba(0, 0, 0, 0.8);
}
`;ve(xr);var gr=`/** ol\u8BA1\u6570\u5668\u5728@f2e-npm/parser */
/** js\u8BA1\u6570\u671F */
.simple-module :global .ck-content p,.simple-module :global .ck-content div {
  margin: 8px 0;
  line-height: 1.625rem;
}
.simple-module [data-menu-index='1'] {
  margin-top: 24px;
}
.simple-module [data-menu-index='1'] h1,.simple-module [data-menu-index='1'] h2,.simple-module [data-menu-index='1'] h3,.simple-module [data-menu-index='1'] h4,.simple-module [data-menu-index='1'] h5,.simple-module [data-menu-index='1'] h6 {
  font-size: 1rem;
  line-height: 1.375rem;
}
.simple-module [data-menu-index='4'] {
  margin-top: 8px;
}
`;ve(gr);var yr=function(e){var n=Object(p.useState)(!1),i=n[0],t=n[1];return Object(p.useEffect)(function(){Ht(oi).then(function(){t(!0)})},[]),i?l.a.createElement(br,h({},e)):l.a.createElement(l.a.Fragment,null)}},szQV:function(tn,Te,w){"use strict";w.r(Te);var p=w("q1tI"),l=w.n(p),rn=w("YpV6"),Ie=w("VOrJ"),ke=w("b1Yu"),T=w("EVdn"),De=w("wd/R"),bn=w("4CIP"),En=w("DMLV"),Ye=w("TSYQ"),Qn=w("9ibs"),Re=w("YVRJ"),Sn=w("FvSR"),un=w("i8i4"),I=w("Wr5T"),Ae=w("wOnQ"),Qe=w("sEfC"),Je=w("z9qM"),sn=w("bdgK"),xn=w("B5yi"),_n=Te.default=()=>l.a.createElement(xn.a,{Page:rn.a})}}]);
