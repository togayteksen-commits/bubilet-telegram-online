import { chromium } from 'playwright';
const need=['BUBILET_EMAIL','BUBILET_PASSWORD','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID'];
for(const k of need)if(!process.env[k])throw Error('Eksik Secret: '+k);
const esc=s=>String(s??'').trim().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({locale:'tr-TR',timezoneId:'Asia/Baku'});
 await page.goto('https://panel.bubilet.com.tr/login',{waitUntil:'domcontentloaded',timeout:90000});
 if(page.url().includes('/login')){
  const email=page.locator('input[type="email"],input[name*="email" i],input[placeholder*="posta" i]').first();
  await email.waitFor({state:'visible',timeout:60000});
  await email.fill(process.env.BUBILET_EMAIL);
  await page.locator('input[type="password"]').first().fill(process.env.BUBILET_PASSWORD);
  await page.getByRole('button',{name:/giriş|login/i}).first().click();
  await page.waitForURL(u=>!u.pathname.includes('/login'),{timeout:90000});
 }
 await page.goto('https://panel.bubilet.com.tr/reports/sales',{waitUntil:'domcontentloaded',timeout:90000});
 await page.getByText('Bugün Bilet',{exact:true}).waitFor({timeout:90000});
 await page.waitForTimeout(5000);
 const report=await page.evaluate(()=>{
  const n=v=>String(v??'').replace(/\s+/g,' ').trim(), all=[...document.querySelectorAll('body *')];
  const val=label=>{const x=all.find(e=>e.children.length===0&&n(e.textContent)===label);if(!x)return '-';const p=x.parentElement;const a=p?[...p.querySelectorAll('*')].filter(e=>!e.children.length).map(e=>n(e.textContent)).filter(Boolean):[];return a[a.indexOf(label)+1]||'-'};
  const events=[...document.querySelectorAll('table tr')].map(r=>{const c=[...r.querySelectorAll('td')].map(x=>n(x.textContent));return c.length>=7?{event:c[0],sold:c[2],stock:c[5],net:c[6]}:null}).filter(Boolean);
  return{summary:{todayTickets:val('Bugün Bilet'),todayNet:val('Bugün Net Ödenecek'),todayRevenue:val('Bugün Ciro'),totalTickets:val('Toplam Bilet'),totalNet:val('Toplam Net Ödenecek'),totalRevenue:val('Toplam Ciro')},events};
 });
 if(!report.events.length)throw Error('Satış tablosu boş.');
 const s=report.summary,stamp=new Intl.DateTimeFormat('tr-TR',{timeZone:'Asia/Baku',dateStyle:'short',timeStyle:'short'}).format(new Date());
 let text=`<b>📊 Event Office — Bubilet Satış Raporu</b>\n<i>Güncelleme: ${esc(stamp)}</i>\n\n<b>Bugün Bilet:</b> ${esc(s.todayTickets)}\n<b>Bugün Net Ödenecek:</b> ${esc(s.todayNet)}\n<b>Bugün Ciro:</b> ${esc(s.todayRevenue)}\n<b>Toplam Bilet:</b> ${esc(s.totalTickets)}\n<b>Toplam Net Ödenecek:</b> ${esc(s.totalNet)}\n<b>Toplam Ciro:</b> ${esc(s.totalRevenue)}\n\n<b>Etkinlikler (${report.events.length})</b>`;
 report.events.forEach((r,i)=>text+=`\n\n<b>${i+1}. ${esc(r.event)}</b>\nSatılan: ${esc(r.sold)}\nStok: ${esc(r.stock)}\nNet Ödenecek: ${esc(r.net)}`);
 const chunks=[];while(text.length>3800){let c=text.lastIndexOf('\n\n',3800);if(c<1000)c=3800;chunks.push(text.slice(0,c));text='<b>📊 Rapor — devam</b>\n\n'+text.slice(c).trim()}chunks.push(text);
 for(const t of chunks){const res=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:process.env.TELEGRAM_CHAT_ID,text:t,parse_mode:'HTML',disable_web_page_preview:true})});const j=await res.json();if(!j.ok)throw Error('Telegram: '+j.description)}
 console.log('Başarılı: '+report.events.length+' etkinlik gönderildi.');
}catch(e){console.error(e.stack||e);process.exitCode=1}finally{await browser.close()}
