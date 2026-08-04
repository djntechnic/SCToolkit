/*ADOBE SYSTEMS INCORPORATED
Copyright 2012 Adobe Systems Incorporated
All Rights Reserved.

NOTICE:  Adobe permits you to use, modify, and distribute this file in accordance with the
terms of the Adobe license agreement accompanying it.  If you have received this file from a
source other than Adobe, then your use, modification, or distribution of it requires the prior
written permission of Adobe.*/
var KT_focusedEl=null;
KT_validateSingle=function(_976,_977){
var _978=_976.charCodeAt(0);
switch(_977){
case "9":
if(_978<58&&_978>47){
return true;
}
break;
case "A":
if((_978<91&&_978>64)||(_978<123&&_978>96)){
return true;
}
break;
case "X":
if((_978<91&&_978>64)||(_978<123&&_978>96)||(_978<58&&_978>47)){
return true;
}
break;
case "?":
return true;
break;
default:
return true;
break;
}
};
KT_maskDefaultValue=function(_979){
switch(_979){
case "9":
return "0";
break;
case "A":
return "a";
break;
case "X":
return "0";
break;
case "?":
return "0";
break;
default:
return "0";
break;
}
};
KT_isSpecialChar=function(_97a){
if(_97a=="9"||_97a=="A"||_97a=="X"||_97a=="?"){
return true;
}else{
return false;
}
};
mask_onValueChanged=function(){
if((typeof window.getSelection=="undefined"&&typeof document.selection=="undefined")){
return;
}
if(KT_focusedEl==null||KT_focusedEl.mask==null||KT_focusedEl.mask==""){
return;
}
var mask=KT_focusedEl.mask;
var val=KT_focusedEl.value;
var i=0;
var _97e=false;
if(val==KT_focusedEl.oldText){
return;
}
if(val.length>mask.length){
val=val.substr(0,mask.length);
_97e=true;
}
for(;i<mask.length;i++){
if(val.charCodeAt(i).toString()!="NaN"){
if(KT_isSpecialChar(mask.charAt(i))){
if(KT_validateSingle(val.charAt(i),mask.charAt(i))){
continue;
}else{
val=KT_focusedEl.oldText;
i=mask.length;
break;
}
}else{
if(val.charAt(i)!=mask.charAt(i)){
if(i==val.length-1){
var _97f=val.substr(val.length-1,val.length);
val=val.substr(0,val.length-1)+mask.charAt(i)+_97f;
_97e=true;
continue;
}else{
val=KT_focusedEl.oldText;
i=mask.length;
}
break;
}
}
}else{
if(val.length<KT_focusedEl.oldText.length){
break;
}
for(;i<mask.length;i++){
if(!KT_isSpecialChar(mask.charAt(i))){
val+=mask.charAt(i);
_97e=true;
}else{
break;
}
}
break;
}
}
if(val.length>mask.length){
val=val.substr(0,mask.length);
_97e=true;
}
if(KT_focusedEl.value!=val){
KT_focusedEl.value=val;
}
KT_focusedEl.oldText=val;
if(_97e){
}
};
mask_parseFirstTime=function(_980,mask){
var _982="";
var _983="";
cond=1;
imask=0;
ival=0;
cnt=0;
while(cond==1){
cond=1;
if(!KT_isSpecialChar(mask.charAt(imask))){
if(_980.charCodeAt(ival).toString()!="NaN"){
if(mask.charAt(imask)==_980.charAt(ival)){
imask++;
ival++;
}else{
_980=_980.substr(0,ival)+mask.charAt(imask)+_980.substr(ival,_980.length);
imask=0;
ival=0;
cond=1;
}
}else{
_980+=KT_maskDefaultValue(mask.charAt(imask));
}
}else{
imask++;
ival++;
}
if(imask>=mask.length||ival>=_980.length){
cond=0;
}
}
for(i=0;i<mask.length;i++){
if(KT_isSpecialChar(mask.charAt(i))){
_982+=mask.charAt(i);
if(_980.charCodeAt(i).toString()!="NaN"){
_983+=_980.charAt(i);
}else{
_983+=KT_maskDefaultValue(mask.charAt(i));
}
}
}
oldvalue=_980;
_980=_983;
var _984="";
for(i=0;i<_982.length;i++){
if(!KT_validateSingle(_980.charAt(i),_982.charAt(i))){
_984+=KT_maskDefaultValue(_982.charAt(i));
}else{
_984+=_980.charAt(i);
}
}
var _985="";
var j=0;
for(i=0;i<mask.length;i++){
if(KT_isSpecialChar(mask.charAt(i))){
_985+=_984.charAt(j++);
}else{
_985+=mask.charAt(i);
}
}
return _985;
};
mask_onSetFocus=function(obj,mask){
if((typeof window.getSelection=="undefined"&&typeof document.selection=="undefined")){
return;
}
if(typeof obj.mask=="undefined"){
ret="";
if(obj.value!=""){
ret=mask_parseFirstTime(obj.value,mask);
}
obj.value=ret;
obj.mask=mask;
}
KT_focusedEl=obj;
if(typeof KT_focusedEl.oldText=="undefined"){
KT_focusedEl.oldText=obj.value;
mask_onValueChanged();
}
};
mask_onKillFocus=function(){
if((typeof window.getSelection=="undefined"&&typeof document.selection=="undefined")){
return;
}
mask_onValueChanged();
KT_focusedEl=null;
};
