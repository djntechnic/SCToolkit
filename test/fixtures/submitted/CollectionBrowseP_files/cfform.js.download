/*ADOBE SYSTEMS INCORPORATED
Copyright 2012 Adobe Systems Incorporated
All Rights Reserved.

NOTICE:  Adobe permits you to use, modify, and distribute this file in accordance with the
terms of the Adobe license agreement accompanying it.  If you have received this file from a
source other than Adobe, then your use, modification, or distribution of it requires the prior
written permission of Adobe.*/
var _CF_error_messages=new Array();
var _CF_error_fields=new Object();
var _CF_FirstErrorField=null;
var _CF_submit_status=new Array();
_CF_signalLoad=function(){
_CF_loaded=1;
};
_CF_onError=function(_925,_926,_927,_928){
if(_CF_error_fields[_926]==null){
if(_CF_FirstErrorField==null){
_CF_FirstErrorField=_926;
}
_CF_error_exists=true;
_CF_error_fields[_926]=_928;
_CF_error_messages[_CF_error_messages.length]=_928;
}
};
_CF_onErrorAlert=function(_929){
var _92a="";
for(var i=0;i<_929.length;i++){
_92a+=_929[i]+"\n";
}
alert(_92a);
return false;
};
updateHiddenValue=function(val,form,name){
if(form==null||form==""){
form=0;
}
if(document.forms[form]==null||document.forms[form][name]==null){
return;
}
document.forms[form][name].value=val;
};
_CF_hasValue=function(obj,_930,_931){
if(_930=="TEXT"||_930=="FILE"||_930=="PASSWORD"||_930=="CFTEXTAREA"||_930=="TEXTAREA"||_930=="CFTEXTINPUT"||_930=="DATEFIELD"){
if(obj.value.length==0){
return false;
}else{
if(_931){
str=obj.value.replace(/^\s+/,"").replace(/\s+$/,"");
if(str.length==0){
return false;
}
}
}
return true;
}else{
if(_930=="SELECT"){
for(i=0;i<obj.length;i++){
if(obj.options[i].selected&&obj.options[i].value.length>0){
return true;
}
}
return false;
}else{
if(_930=="SINGLE_VALUE_RADIO"||_930=="SINGLE_VALUE_CHECKBOX"){
if(obj.checked){
return true;
}else{
return false;
}
}else{
if(_930=="RADIO"||_930=="CHECKBOX"){
if(obj.length==undefined&&obj.checked){
return true;
}else{
for(i=0;i<obj.length;i++){
if(obj[i].checked){
return true;
}
}
}
return false;
}else{
if(_930=="CFTREE"){
if(obj["value"].length>0){
return true;
}else{
return false;
}
}else{
if(_930=="RICHTEXT"){
var _932=FCKeditorAPI.GetInstance(obj.id);
var val=_932.GetXHTML();
if(val.length==0){
return false;
}else{
if(_931){
str=val.replace(/^\s+/,"").replace(/\s+$/,"");
if(str.length==0){
return false;
}
}
return true;
}
}else{
return true;
}
}
}
}
}
}
};
_CF_checkdate=function(_934,_935){
_934=_934.replace(/^\s+/,"").replace(/\s+$/,"");
_934=_934=_934.replace(/{d \'/,"").replace(/'}/,"");
if(_935){
if(_934.length==0){
return false;
}
}else{
if(_934.length==0){
return true;
}
}
if(_934.length==0){
return true;
}
isplit=_934.indexOf("/");
splitchr="/";
if(isplit==-1){
isplit=_934.indexOf(".");
splitchr=".";
}
if(isplit==-1){
isplit=_934.indexOf("-");
splitchr="-";
}
if(isplit==-1||isplit==_934.length){
return false;
}
var _936=_934.substring(0,isplit);
if(_936.length==4){
sYear=_934.substring(0,isplit);
isplit=_934.indexOf(splitchr,isplit+1);
if(isplit==-1||(isplit+1)==_934.length){
return false;
}
sMonth=_934.substring((sYear.length+1),isplit);
sDay=_934.substring(isplit+1);
}else{
sMonth=_934.substring(0,isplit);
isplit=_934.indexOf(splitchr,isplit+1);
if(isplit==-1||(isplit+1)==_934.length){
return false;
}
sDay=_934.substring((sMonth.length+1),isplit);
sYear=_934.substring(isplit+1);
}
if((sDay.length==0)||(sMonth.length==0)||(sYear.length==0)){
return false;
}
if(!_CF_checkinteger(sMonth)){
return false;
}else{
if(!_CF_checkrange(sMonth,1,12)){
return false;
}else{
if(!_CF_checkinteger(sYear)){
return false;
}else{
if(sYear.length!=1&&sYear.length!=2&&sYear.length!=4){
return false;
}else{
if(!_CF_checkrange(sYear,0,9999)){
return false;
}else{
if(!_CF_checkinteger(sDay)){
return false;
}else{
if(!_CF_checkday(sYear,sMonth,sDay)){
return false;
}else{
return true;
}
}
}
}
}
}
}
};
_CF_checkeurodate=function(_937,_938){
_937=_937.replace(/^\s+/,"").replace(/\s+$/,"");
_937=_937=_937.replace(/{d \'/,"").replace(/'}/,"");
if(_938){
if(_937.length==0){
return false;
}
}else{
if(_937.length==0){
return true;
}
}
isplit=_937.indexOf("/");
splitchr="/";
if(isplit==-1){
isplit=_937.indexOf(".");
splitchr=".";
}
if(isplit==-1){
isplit=_937.indexOf("-");
splitchr="-";
}
if(isplit==-1||isplit==_937.length){
return false;
}
var _939=_937.substring(0,isplit);
if(_939.length==4){
sYear=_937.substring(0,isplit);
isplit=_937.indexOf(splitchr,isplit+1);
if(isplit==-1||(isplit+1)==_937.length){
return false;
}
sMonth=_937.substring((sYear.length+1),isplit);
sDay=_937.substring(isplit+1);
}else{
sDay=_937.substring(0,isplit);
isplit=_937.indexOf(splitchr,isplit+1);
if(isplit==-1||(isplit+1)==_937.length){
return false;
}
sMonth=_937.substring((sDay.length+1),isplit);
sYear=_937.substring(isplit+1);
}
if(!_CF_checkinteger(sMonth)){
return false;
}else{
if(!_CF_checkrange(sMonth,1,12)){
return false;
}else{
if(!_CF_checkinteger(sYear)){
return false;
}else{
if(!_CF_checkrange(sYear,0,null)){
return false;
}else{
if(!_CF_checkinteger(sDay)){
return false;
}else{
if(!_CF_checkday(sYear,sMonth,sDay)){
return false;
}else{
return true;
}
}
}
}
}
}
};
_CF_checkday=function(_93a,_93b,_93c){
maxDay=31;
if(_93b==4||_93b==6||_93b==9||_93b==11){
maxDay=30;
}else{
if(_93b==2){
if(_93a%4>0){
maxDay=28;
}else{
if(_93a%100==0&&_93a%400>0){
maxDay=28;
}else{
maxDay=29;
}
}
}
}
return _CF_checkrange(_93c,1,maxDay);
};
_CF_checkinteger=function(_93d,_93e){
_93d=_93d.replace(/^\s+/,"").replace(/\s+$/,"");
_93d=_93d.replace(/[$Â£Â¥â‚¬,~+]?/g,"");
if(_93e){
if(_93d.length==0){
return false;
}
}else{
if(_93d.length==0){
return true;
}
}
var _93f=".";
var _940=_93d.indexOf(_93f);
if(_940==-1){
return _CF_checknumber(_93d);
}else{
return false;
}
};
_CF_numberrange=function(_941,_942,_943,_944){
if(_944){
if(_941.length==0){
return false;
}
}else{
if(_941.length==0){
return true;
}
}
if(_942!=null){
if(_941<_942){
return false;
}
}
if(_943!=null){
if(_941>_943){
return false;
}
}
return true;
};
_CF_checknumber=function(_945,_946){
var _947=" .+-0123456789";
var _948=" .0123456789";
var _949;
var _94a=false;
var _94b=false;
var _94c=false;
_945=_945.replace(/^\s+/,"").replace(/\s+$/,"");
_945=_945.replace(/[$Â£Â¥â‚¬,~+]?/g,"");
if(_946){
if(_945.length==0){
return false;
}
}else{
if(_945.length==0){
return true;
}
}
_949=_947.indexOf(_945.charAt(0));
if(_949==1){
_94a=true;
}else{
if(_949<1){
return false;
}
}
for(var i=1;i<_945.length;i++){
_949=_948.indexOf(_945.charAt(i));
if(_949<0){
return false;
}else{
if(_949==1){
if(_94a){
return false;
}else{
_94a=true;
}
}else{
if(_949==0){
if(_94a||_94c){
_94b=true;
}
}else{
if(_94b){
return false;
}else{
_94c=true;
}
}
}
}
}
return true;
};
_CF_checkrange=function(_94e,_94f,_950,_951){
_94e=_94e.replace(/^\s+/,"").replace(/\s+$/,"");
if(_951){
if(_94e.length==0){
return false;
}
}else{
if(_94e.length==0){
return true;
}
}
if(!_CF_checknumber(_94e)){
return false;
}else{
return (_CF_numberrange((eval(_94e)),_94f,_950));
}
return true;
};
_CF_checktime=function(_952,_953){
_952=_952.replace(/^\s+/,"").replace(/\s+$/,"");
_952=_952.replace(/\s+:\s+/,":");
_952=_952=_952.replace(/{t \'/,"").replace(/'}/,"");
if(_953){
if(_952.length==0){
return false;
}
}else{
if(_952.length==0){
return true;
}
}
var _954=_CF_checkregex(_952,/^((([0-1]?\d)|(2[0-3])):[0-5]?\d)?(:[0-5]?\d)? ?([AP]M|[AP]m|[ap]m|[ap]M)?$/,_953);
return _954;
};
_CF_checkphone=function(_955,_956){
_955=_955.replace(/^\s+/,"").replace(/\s+$/,"");
if(_956){
if(_955.length==0){
return false;
}
}else{
if(_955.length==0){
return true;
}
}
if(_955.length==0){
return true;
}
return _CF_checkregex(_955,/^(((1))?[ ,\-,\.]?([\\(]?([1-9][0-9]{2})[\\)]?))?[ ,\-,\.]?([^0-1]){1}([0-9]){2}[ ,\-,\.]?([0-9]){4}(( )((x){0,1}([0-9]){1,5}){0,1})?$/,_956);
};
_CF_checkzip=function(_957,_958){
_957=_957.replace(/^\s+/,"").replace(/\s+$/,"");
if(_958){
if(_957.length==0){
return false;
}
}else{
if(_957.length==0){
return true;
}
}
return _CF_checkregex(_957,/^([0-9]){5,5}$|(([0-9]){5,5}(-| ){1}([0-9]){4,4}$)/,_958);
};
_CF_checkcreditcard=function(_959,_95a){
_959=_959.replace(/^\s+/,"").replace(/\s+$/,"");
if(_95a){
if(_959.length==0){
return false;
}
}else{
if(_959.length==0){
return true;
}
}
if(_959.length==0){
return true;
}
var _95b=" -";
var _95c="";
var _95d;
for(var i=0;i<_959.length;i++){
_95d=_95b.indexOf(_959.charAt(i));
if(_95d<0){
_95c+=_959.substring(i,(i+1));
}
}
if(_95c.length<13||_95c.length>19){
return false;
}
if(_95c.charAt(0)=="+"){
return false;
}
if(!_CF_checkinteger(_95c)){
return false;
}
var _95f=_95c.length%2==1?false:true;
var _960=0;
var _961;
for(var i=0;i<_95c.length;i++){
_961=eval(_95c.charAt(i));
if(_95f){
_961*=2;
_960+=(_961%10);
if((_961/10)>=1){
_960++;
}
_95f=false;
}else{
_960+=_961;
_95f=true;
}
}
return (_960%10)==0?true:false;
};
_CF_checkssn=function(_962,_963){
_962=_962.replace(/^\s+/,"").replace(/\s+$/,"");
if(_963){
if(_962.length==0){
return false;
}
}else{
if(_962.length==0){
return true;
}
}
return _CF_checkregex(_962,/^[0-9]{3}(-| )[0-9]{2}(-| )[0-9]{4}$/,_963);
};
_CF_checkEmail=function(_964,_965){
_964=_964.replace(/^\s+/,"").replace(/\s+$/,"");
if(_965){
if(_964.length==0){
return false;
}
}else{
if(_964.length==0){
return true;
}
}
return _CF_checkregex(_964,/^[a-zA-Z_0-9-'\+~]+(\.[a-zA-Z_0-9-'\+~]+)*@([a-zA-Z_0-9-]+\.)+[a-zA-Z]*$/,_965);
};
_CF_checkURL=function(_966,_967){
_966=_966.replace(/^\s+/,"").replace(/\s+$/,"");
if(_967){
if(_966.length==0){
return false;
}
}else{
if(_966.length==0){
return true;
}
}
return _CF_checkregex(_966.toLowerCase(),/^((http|https|ftp|file)\:\/\/([a-zA-Z0-0]*:[a-zA-Z0-0]*(@))?[a-zA-Z0-9-\.]+(\.[a-zA-Z]{2,3})?(:[a-zA-Z0-9]*)?\/?([a-zA-Z0-9-\._\?\,\'\/\+&amp;%\$#\=~])*)|((mailto)\:[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]*)|((news)\:[a-zA-Z0-9\.]*)$/,_967);
};
_CF_checkUUID=function(_968,_969){
_968=_968.replace(/^\s+/,"").replace(/\s+$/,"");
if(_969){
if(_968.length==0){
return false;
}
}else{
if(_968.length==0){
return true;
}
}
return _CF_checkregex(_968,/[A-Fa-f0-9]{8,8}-[A-Fa-f0-9]{4,4}-[A-Fa-f0-9]{4,4}-[A-Fa-f0-9]{16,16}/,_969);
};
_CF_checkGUID=function(_96a,_96b){
_96a=_96a.replace(/^\s+/,"").replace(/\s+$/,"");
if(_96b){
if(_96a.length==0){
return false;
}
}else{
if(_96a.length==0){
return true;
}
}
return _CF_checkregex(_96a,/[A-Fa-f0-9]{8,8}-[A-Fa-f0-9]{4,4}-[A-Fa-f0-9]{4,4}-[A-Fa-f0-9]{4,4}-[A-Fa-f0-9]{12,12}/,_96b);
};
_CF_checkBoolean=function(_96c,_96d){
_96c=_96c.replace(/^\s+/,"").replace(/\s+$/,"");
if(_96d){
if(_96c.length==0){
return false;
}
}else{
if(_96c.length==0){
return true;
}
}
if(_96c.toUpperCase()=="TRUE"||_96c.toUpperCase()=="YES"||(_CF_checknumber(_96c)&&_96c!="0")){
return true;
}else{
if(_96c.toUpperCase()=="FALSE"||_96c.toUpperCase()=="NO"||_96c=="0"){
return true;
}else{
return false;
}
}
};
_CF_setFormParam=function(_96e,_96f,_970){
var _971="document['"+_96e+"']['"+_96f+"']";
var obj=eval(_971);
if(obj==undefined){
return false;
}else{
obj.value=_970;
return true;
}
};
_CF_checkregex=function(_973,_974,_975){
if(_975){
if(_973.length==0){
return false;
}
}else{
if(_973.length==0){
return true;
}
}
return _974.test(_973);
};
