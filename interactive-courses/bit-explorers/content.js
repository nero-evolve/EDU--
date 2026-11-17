export const CARDS=[0,1,2,3,4].map(i=>{const value=1<<i,list=[];for(let n=0;n<=31;n++)if(n&value)list.push(n);return{i,value,list};});
export const HEART=["00111100","01000010","10100101","10000001","10100101","10011001","01000010","00111100"];
export const PIXEL_NAME="笑臉";
export const CHAPS=["數字線索","0 和 1","數字拼圖","文字編碼","像素圖片","聲音取樣"];

const mix=(seed,salt)=>{let h=2166136261;for(const c of String(seed)+':'+salt){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return()=>{h=(h+0x6D2B79F5)|0;let t=Math.imul(h^h>>>15,1|h);t=(t+Math.imul(t^t>>>7,61|t))^t;return((t^t>>>14)>>>0)/4294967296;};};
const RANGES={v1:[3,7,3],v2:[4,15,4],v3:[6,31,5],v4:[48,240,8],b1:[3,7,3],b2:[4,15,4],b3:[6,31,5],b4:[48,220,8],"check-3":[13,13,5]};
const WORDS=["Hi","Go","Up","No","We","OK"];
export function problems(seed){
 const rnd=mix(seed,'bit-explorers-v4'),out={};
 for(const [id,[lo,hi,n]] of Object.entries(RANGES)){let value;if(id==="v4"){const selected=new Set([128]);while(selected.size<4)selected.add(1<<Math.floor(rnd()*7));value=[...selected].reduce((sum,bit)=>sum+bit,0);}else do value=lo+Math.floor(rnd()*(hi-lo+1));while(!(value&(value-1)));out[id]={n,value,bits:value.toString(2).padStart(n,"0")};}
 out["two-bit-value"]={n:2,value:2,bits:"10"};
 const code=65+Math.floor(rnd()*26),word=WORDS[Math.floor(rnd()*WORDS.length)];
 out.d1={letter:String.fromCharCode(code),code,bits:code.toString(2).padStart(8,"0")};
 out.d2={word,bits:[...word].map(c=>c.charCodeAt(0).toString(2).padStart(8,"0")).join(" ")};
 return out;
}
export function optionOrder(seed,id,count){const rnd=mix(seed,'choices:'+id),order=[...Array(count).keys()];for(let i=count-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[order[i],order[j]]=[order[j],order[i]];}return order;}
export const hintLimit=s=>s.hints?.length||0;

export const STEPS=[
 {ch:0,t:"story",id:"welcome",h:"任務 1｜尋寶數字線索",visual:"number-quest",guide:"想像你和同學在玩尋寶猜數字。每張卡都是一條線索：你的數字出現在卡上，就回答「有」；沒有出現，就回答「沒有」。",steps:["心裡想一個 0 到 31 的數字。","逐張查看線索卡，回答有或沒有。","看看小波能不能用線索猜中。"],go:"開始尋寶"},
 {ch:0,t:"trick",id:"card-game",h:"遊戲｜小波猜數字",guide:"心裡選一個 0 到 31 的數字。看完一張卡，就回答「有」或「沒有」。五張都回答後，看小波猜得對不對。",practice:1},
 {ch:0,t:"story",id:"card-rule",h:"第一個線索｜卡片上的數字",visual:"cards",guide:"每張卡左上角的數字，是這張卡的代表值。先看一張卡：它的代表值是 1，有這個數字就回答「有」。",steps:["第一張卡代表值 1。","第二張卡代表值 2。","後面的卡代表值依序是 4、8、16。"],go:"找出五個代表值"},
 {ch:0,t:"text",id:"card-values",h:"練習｜找出卡片代表值",visual:"cards",ask:"依序輸入五張卡左上角的數字。",ph:"例如 1、2、4、8、16",chk:v=>v.replace(/[^0-9]/g,"")==="124816",hints:["看每張卡左上角的小數字。","由小到大輸入：1、2、4、8、16。"],ok:"找到了！代表值是 1、2、4、8、16。"},
 {ch:0,t:"opt",id:"card-one-bit",h:"想一想｜一張卡有幾種回答？",visual:"one-card",ask:"只看一張卡，你可以回答「有」或「沒有」。一共有幾種回答？",opts:["1 種","2 種","3 種","4 種"],right:1,hints:["把「有」和「沒有」都算進去。","只有兩種回答。"],ok:"沒錯，只有兩種回答：有或沒有。"},
 {ch:0,t:"story",id:"card-add",h:"第二個線索｜把有的卡加起來",visual:"cards",guide:"把回答「有」的卡片代表值加起來，就會得到你心裡的數字。",steps:["例如第 1、3 張卡有這個數字。","代表值是 1 和 4。","1 + 4 = 5，所以原本想的數字是 5。"],go:"試著算一題"},
 {ch:0,t:"opt",id:"card-sum",h:"練習｜算出藏起來的數字",visual:"sum-cards",ask:"第 1、3、5 張卡都有這個數字。原本想的數字是多少？",opts:["13","21","25","31"],right:1,hints:["這三張卡代表 1、4、16。","把 1 + 4 + 16 加起來。"],ok:"答對了！1 + 4 + 16 = 21。"},
 {ch:0,t:"story",id:"card-doubles",h:"第三個線索｜每張卡都變兩倍",guide:"代表值每次都變成前一張的兩倍：1、2、4、8、16。每多一張卡，能表示的數字就更多。",steps:["1 張卡有 2 種回答方式。","2 張卡有 4 種組合。","3 張卡有 8 種組合。"],go:"練習看組合數"},
 {ch:0,t:"opt",id:"card-combinations",h:"練習｜三張卡有幾種組合？",visual:"three-cards",ask:"每張卡都只有「有」和「沒有」兩種回答。三張卡總共有幾種不同回答組合？",opts:["3 種","6 種","8 種","9 種"],right:2,hints:["每多一張卡，組合數就乘以 2。","2 × 2 × 2 = ?"],ok:"正確！三張卡有 8 種不同組合。"},
 {ch:0,t:"story",id:"card-range",h:"看看五張卡能表示多大",guide:"五張卡全回答「沒有」就是 0；五張卡全回答「有」，就把五個代表值全部加起來。",steps:["最小的數字是 0。","最大值是 1 + 2 + 4 + 8 + 16。","所以五張卡可以表示 0 到 31。"],go:"完成本章檢核"},
 {ch:0,t:"opt",id:"check-1",checkpoint:true,h:"章末檢核｜數字卡",visual:"cards",ask:"五張卡全都回答「有」，代表的數字是多少？",opts:["16","30","31","32"],right:2,hints:["把 1、2、4、8、16 全部加起來。","1 + 2 + 4 + 8 + 16 = ?"],ok:"答對了！五張卡全有是 31，全沒有是 0。"},

 {ch:1,t:"story",id:"bit-byte",h:"任務 2｜電燈開關的 0 和 1",visual:"switch-story",guide:"想想牆上的電燈開關：燈打開記成 1，燈關掉記成 0。電腦也會用這兩種狀態保存資料。",steps:["開關打開，燈亮：記成 1。","開關關閉，燈暗：記成 0。","能記下 0 或 1 的一個位置，叫做一個位元。"],go:"試試一個位元"},
 {ch:1,t:"opt",id:"one-bit",h:"練習｜一個位元",ask:"一個小開關有「關」和「開」兩種狀態。它可以表示幾種不同情況？",opts:["1 種","2 種","8 種","10 種"],right:1,hints:["關和開都算一種。","一個位元只有 0、1 兩種。"],ok:"正確，一個位元有 2 種可能。"},
 {ch:1,t:"story",id:"two-bits",h:"兩個位元排在一起",visual:"place",guide:"兩個開關可以排出 00、01、10、11 四種組合。右邊的位置代表 1；左邊的位置代表 2。",steps:["00：左、右都是 0，兩格都不加，所以是 0。","01：左邊是 0 不加 2；右邊是 1 加 1，所以是 1。","10：左邊是 1 加 2；右邊是 0 不加 1，所以是 2。","11：兩邊都是 1，把 2 和 1 加起來，所以是 3。"],go:"試試讀兩個位元"},
 {ch:1,t:"conv",id:"two-bit-value",h:"練習｜讀懂 10",ask:"看題目中的位元，點選每個 1 的位置值，算出它代表的十進位數字。",hints:["位元是 1 的位置要加進去。","位元是 0 的位置不用加。"],ok:"沒錯，10 代表 2。"},
 {ch:1,t:"story",id:"bit-values",h:"位元變多，位置值也變大",guide:"從右邊開始看，位置值依序是 1、2、4、8、16……每往左一格，位置值就乘以 2。",steps:["3 個位元的位置值是 4、2、1。","4 個位元的位置值是 8、4、2、1。","看到 1，就把那一格的位置值加起來。"],go:"先讀短短一串"},
 {ch:1,t:"conv",id:"v1",h:"練習 1｜讀 3 個位元",guide:"這題只有 3 格。先從右邊看位置值 1、2、4，再把位元是 1 的值加起來。",hints:["只加位元是 1 的位置值。","由右到左的位置值是 1、2、4。"],ok:"答對了！把 1 的位置值加起來，就是這串位元代表的數字。"},
 {ch:1,t:"conv",id:"v2",h:"練習 2｜讀 4 個位元",guide:"多一格後，最左邊的位置值變成 8。其他位置仍是 4、2、1。",hints:["由右到左的位置值是 1、2、4、8。","只把位元是 1 的位置值加起來。"],ok:"很好！每多一格，最左邊的位置值就再乘以 2。"},
 {ch:1,t:"conv",id:"v3",h:"練習 3｜讀 5 個位元",guide:"這次有 5 格，位置值由左到右是 16、8、4、2、1。",hints:["先把每一格的位置值寫出來。","只加位元是 1 的位置值。"],ok:"答對了！你已經能讀 5 個位元了。"},
 {ch:1,t:"story",id:"byte-intro",h:"八個位元叫一個位元組",guide:"電腦常把 8 個位元排成一組，叫做一個位元組。位置值由左到右是 128、64、32、16、8、4、2、1。",steps:["全是 0：代表 0。","全是 1：位置值全部相加，代表 255。","所以一個位元組能表示 0 到 255。"],go:"挑戰 8 格"},
 {ch:1,t:"conv",id:"v4",h:"挑戰｜讀 8 個位元",guide:"你已經練過 3、4、5 格。現在用一樣的方法讀 8 格；不用急，可以先從最右邊開始。",hints:["由右到左的位置值是 1、2、4、8、16、32、64、128。","只把位元是 1 的位置值加起來。"],ok:"完成！8 個位元是一個位元組，可以表示 0 到 255。"},
 {ch:1,t:"opt",id:"check-2",checkpoint:true,h:"章末檢核｜位元組",ask:"8 個位元可以排出幾種不同的 0 和 1？",opts:["8 種","64 種","256 種","512 種"],right:2,hints:["每增加一個位元，可能的組合就加倍。","8 個位置就是 2 連乘 8 次。"],ok:"沒錯，8 個位元可以排出 256 種組合，也就是 0 到 255。"},

 {ch:2,t:"story",id:"binary-builder",h:"任務 3｜用能量積木拼數字",visual:"power-blocks",guide:"闖關遊戲裡，能量積木有不同點數。挑幾塊加起來湊到目標，就像選擇二進位裡的位置值。",steps:["每個位元位置代表一種點數，例如 4、2、1。","選用的位置記成 1；沒選的位置記成 0。","把選用的點數加起來，就是拼出的數字。"],go:"先用 3 格拼數字"},
 {ch:2,t:"build",id:"b1",h:"練習 1｜用 3 格拼數字",interaction:"drag",hints:["3 格的位置值是 4、2、1。","從最大的位置值開始，放得下就選。"],ok:"拼對了！把選到的位置值相加，就得到目標數字。"},
 {ch:2,t:"story",id:"build-example",h:"拼數字時可以這樣想",guide:"目標是 5：先看 4，放得下就選；剩下 1，再選 1；2 放不下就不選。",steps:["位置值 4、2、1。","選 4、不選 2、選 1。","所以 5 寫成 101。"],go:"再試 4 格"},
 {ch:2,t:"build",id:"b2",h:"練習 2｜用 4 格拼數字",interaction:"drag",hints:["4 格的位置值是 8、4、2、1。","選中的位置值加起來，要剛好等於目標。"],ok:"很好！每格只能選一次，記得檢查總和。"},
 {ch:2,t:"build",id:"b3",h:"練習 3｜用 5 格拼數字",interaction:"drag",hints:["5 格的位置值是 16、8、4、2、1。","從大到小挑選，放不下就先跳過。"],ok:"答對了！你已經能用 5 格拼出數字。"},
 {ch:2,t:"story",id:"build-eight",h:"最後試試 8 格",guide:"方法完全一樣，只是位置變多。8 格的位置值是 128、64、32、16、8、4、2、1。",steps:["從最大的 128 開始。","選到的值從目標中扣掉。","再看下一個位置值放不放得下。"],go:"挑戰 8 格拼圖"},
 {ch:2,t:"build",id:"b4",h:"挑戰｜用 8 格拼數字",interaction:"drag",hints:["從 128、64、32 開始往下看。","放得下就選，放不下就跳過。"],ok:"完成！八個位置能表示 0 到 255 的整數。"},
 {ch:2,t:"build",id:"check-3",checkpoint:true,h:"關卡檢核｜拼數字",guide:"用 5 個位元表示 13。點選需要的位置，讓目前的十進位數字剛好等於目標。",hints:["13 = 8 + 4 + 1。","位置值是 16、8、4、2、1。"],ok:"正確！13 = 8 + 4 + 1，所以位元是 01101。"},

 {ch:3,t:"story",id:"text-code",h:"任務 4｜用暗號表傳文字",visual:"secret-code",guide:"想像班上約好一本暗號表：每個字母對應一個編號。電腦也會查編碼表，把文字換成數字，再用 0 和 1 記下來。",steps:["先從編碼表查出字母的編號。","再把編號換成 0 和 1。","大家用同一張表，就能把訊息讀回來。"],go:"解開字母暗號"},
 {ch:3,t:"text",id:"d1",h:"小遊戲｜把字母編成位元",tool:1,hints:["先用 8 格工具湊出字母的編號。","從最大的位值開始：放得下選 1，否則選 0。"],ok:"很好！8 個 0 和 1 可以記下一個字母編號。"},
 {ch:3,t:"text",id:"d2",h:"解碼訊息｜讀出兩個字母",tool:1,table:1,hints:["一次解一組 8 個位元。","先看編碼表裡的大寫和小寫字母編號。"],ok:"訊息解開了！電腦會用編碼表把編號還原成文字。"},
 {ch:3,t:"opt",id:"check-4",checkpoint:true,h:"關卡檢核｜文字編碼",ask:"電腦要保存英文字母，通常會先怎麼做？",opts:["把字母換成編碼表裡的數字，再存成 0 和 1","把字母畫成圖片","把字母變成聲音","直接存進螢幕"],right:0,hints:["想想剛才的編碼表。","字母先換成編號，編號再變成位元。"],ok:"答對了！編碼表讓電腦和人可以用同一套規則交換文字。"},

 {ch:4,t:"story",id:"pixel-image",h:"任務 5｜用小方格拼圖片",visual:"mosaic-story",guide:"像拼豆或馬賽克一樣，數位圖片也是一格一格排出來的。電腦記下每格的顏色，就能拼回圖案。",steps:["黑白圖裡，1 可以代表亮格，0 代表暗格。","每一格都要記下顏色。","格子越細、數量越多，通常能表現更多圖案細節。"],go:"動手拼出笑臉"},
 {ch:4,t:"pixel",id:"draw",h:"拖曳畫格｜還原笑臉",visual:"pixels",skip:1},
 {ch:4,t:"opt",id:"check-5",checkpoint:true,h:"關卡檢核｜像素圖片",ask:"把 8 × 8 的圖片改成 16 × 16，會怎樣？",opts:["像素格變多，能畫更多細節，也要記更多資料","圖片一定會變小","顏色會自動變成聲音","完全沒有差別"],right:0,hints:["比較 8 × 8 和 16 × 16 的格子總數。","更多格子代表更多圖片資料。"],ok:"對了！像素變多，可以畫更多細節，但也要保存更多資料。"},

 {ch:5,t:"story",id:"sound-sampling",h:"任務 6｜修復小波的聲音",visual:"sound-snapshot",guide:"小波收到一段被切碎的音效。電腦會隔一小段時間記下音量，像替聲音拍快照，再把快照連起來。快照拍得越密，越容易拼回原本的聲音。",steps:["每一個快照記下當下的音量，叫做一個取樣點。","快照太少，可能漏掉聲音的高低變化。","快照多一些，拼出的聲音通常更接近原音，但要記的資料也更多。"],go:"前往聲音修復站"},
 {ch:5,t:"wave",id:"explore",h:"聲音修復站｜調整快照次數",skip:1},
 {ch:5,t:"opt",id:"check-6",checkpoint:true,h:"關卡檢核｜修復聲音",ask:"如果小波只拍了很少張聲音快照，拼回來的音效可能會怎樣？",opts:["和原本完全一樣","可能漏掉變化，聽起來不太一樣","一定變大聲","自動變成圖片"],right:1,hints:["回想快照少時，橘線和灰色原音差多少。","快照少，記下來的聲音線索也少。"],ok:"答對了！快照太少可能漏掉聲音變化。"},
 {ch:5,t:"final",id:"finish",h:"任務完成｜你會解讀資料了",guide:"你完成了六個任務！現在你知道電腦會用 0 和 1 記錄數字、文字、圖片和聲音。"}
];

export const CHAPTER_STARTS=CHAPS.map((_,chapter)=>STEPS.findIndex(step=>step.ch===chapter));
