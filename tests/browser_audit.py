"""Run with Playwright and Chrome installed; uses isolated profiles and mocked API results."""
import sys, threading, json, traceback, tempfile
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from server import LocalHandler
from playwright.sync_api import sync_playwright
class QuietHandler(LocalHandler):
 def log_message(self,*args):pass
http=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=http.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{http.server_port}'
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(channel='chrome',headless=True)
 def run(name,fn):
  ctx=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:
   fn(page,ctx)
   assert not errors, errors
   results.append({'test':name,'passed':True})
  except Exception as exc:
   results.append({'test':name,'passed':False,'error':str(exc)[:700]+' '+traceback.format_exc().splitlines()[-3]})
  finally:
   print(('PASS ' if results[-1]['passed'] else 'FAIL ')+name+(': '+results[-1].get('error','') if not results[-1]['passed'] else ''),flush=True)
   ctx.close()
 def goto(p,path='new-listing.html?new=1'):
  p.goto(base+'/'+path,wait_until='domcontentloaded');p.wait_for_function("typeof buildSearchSuggestions === 'function'")
 def fill(p):
  p.locator('#itemName').fill('Blue');p.locator('#brand').fill('Nike');p.locator('#category').select_option('shoes');p.locator('[data-condition="good"]').click();p.locator('#price').fill('45')
 def smoke(p,c):
  for file in ROOT.glob('*.html'):
   goto(p,file.name)
   assert p.locator('main').count()==1,file.name
   assert p.evaluate("document.documentElement.scrollWidth <= innerWidth+1"), 'desktop overflow '+file.name
   ids=p.locator('[id]').evaluate_all('(els)=>els.map(el=>el.id)');assert len(ids)==len(set(ids)), 'duplicate ids '+file.name
   p.set_viewport_size({'width':390,'height':844})
   assert p.evaluate("document.documentElement.scrollWidth <= innerWidth+1"), 'mobile overflow '+file.name
   p.set_viewport_size({'width':1440,'height':1000})
  goto(p);fill(p);p.locator('#researchLabel').scroll_into_view_if_needed();p.screenshot(path='/tmp/listinglab-audit-desktop.png');p.set_viewport_size({'width':390,'height':844});p.locator('#researchLabel').scroll_into_view_if_needed();p.screenshot(path='/tmp/listinglab-audit-mobile.png')
 def fresh(p,c):
  goto(p);fill(p);p.locator('#saveDraftBtn').click();p.locator('nav.navbar a[href="new-listing.html?new=1"]').click();assert p.locator('#brand').input_value()==''
  p.locator('#loadDraftBtn').click();assert p.locator('#brand').input_value()=='Nike'
 def comps(p,c):
  goto(p);fill(p);p.locator('#manualComp1').fill('30');p.locator('#manualComp2').fill('50');p.locator('#applyCompPriceBtn').click();assert p.locator('#price').input_value()=='40.00'
  p.locator('#saveDraftBtn').click();p.reload(wait_until='domcontentloaded');p.locator('#loadDraftBtn').click();assert p.locator('#manualComp1').input_value()=='30','Manual comp prices lost on draft restore'
 def photos(p,c):
  goto(p);fill(p)
  for cat in ['shoes','bags','tops','bottoms','shorts','skirts','dresses','outerwear','activewear','jewelry','accessories','other']:
   p.locator('#category').select_option(cat);assert p.locator('#photoRequirementList input').count()>=9
  p.locator('#customItemType').fill('Camera');p.locator('#photoRequirementList input').first.check();p.locator('#additionalPhotoShot').fill('Lens details');p.locator('#addPhotoShotBtn').click();assert p.locator('#photoRequirementList').inner_text().endswith('Additional: Lens details')
  p.locator('#saveDraftBtn').click();p.reload(wait_until='domcontentloaded');p.locator('#loadDraftBtn').click();assert p.locator('#photoRequirementList input').first.is_checked();assert p.locator('#customItemType').input_value()=='Camera'
 def description(p,c):
  goto(p);fill(p);assert p.locator('#generateDescriptionBtn').count()==0
  p.locator('summary').filter(has_text='Additional Details').click();p.locator('#productType').fill('running shoes');p.locator('#material').fill('mesh');p.locator('#keyFeatures').fill('lace-up closure, cushioned footbed');p.locator('#size').fill('8')
  initial=p.locator('#notes').input_value();assert 'Made from mesh.' in initial and 'cushioned footbed' in initial and 'size 8' in initial
  p.locator('#notes').fill(initial+'\n\nTiny heel scuff. Length 10 inches.');p.locator('#brand').fill('Adidas');text=p.locator('#notes').input_value();assert 'Tiny heel scuff' in text and 'Length 10 inches' in text;assert 'Nike' not in text,'Old generated description duplicated'
  p.locator('#saveDraftBtn').click();p.reload(wait_until='domcontentloaded');p.locator('#loadDraftBtn').click();p.locator('#color').fill('Black');assert 'Tiny heel scuff' in p.locator('#notes').input_value();assert 'Black' in p.locator('#notes').input_value()
  p.locator('#notes').fill('My carefully edited description.');p.locator('#brand').fill('Asics');assert p.locator('#notes').input_value()=='My carefully edited description.'
 def template(p,c):
  goto(p)
  output=p.evaluate("renderTemplateTokens('{{brand}} {itemName}', {brand:'Nike',itemName:'Blue'})")
  assert output=='Nike Blue',repr(output)
  fill(p);p.evaluate("upsertTemplate({id:'test',name:'Test',description:'{{brand}} item with {{flaws}}',keywords:'sporty, running',category:'shoes'})");p.reload(wait_until='domcontentloaded');fill(p);p.locator('#templateSelect').select_option('test');p.locator('#applyTemplateBtn').click();assert 'sporty' in p.locator('#keywords').input_value(),'Template keywords discarded'
 def edit(p,c):
  goto(p);fill(p);p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');p.locator('[data-status-id]').select_option('sold');p.locator('[data-edit]').click();p.wait_for_url('**/new-listing.html');assert p.locator('#listingForm button[type=submit]').inner_text()=='Update Listing','Editing button says Save Listing';p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('[data-status-id]').input_value()=='sold','Edit changed sold status'
 def search(p,c):
  goto(p);fill(p);p.locator('summary').filter(has_text='Additional Details').click();p.locator('#styleModel').fill('Air Max 90');p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');p.locator('#dashboardSearch').fill('Air Max');assert p.locator('#listingsTableBody tr').count()==1,'Dashboard cannot search model'
 def storage(p,c):
  goto(p);fill(p);p.evaluate("() => { Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')}; }");p.locator('#saveDraftBtn').click();assert 'saved' not in p.locator('#formStatus').inner_text().lower(),'Failed draft save falsely reports success';assert p.locator('#formError').inner_text(),'Storage error not shown'
 def pricing(p,c):
  goto(p,'pricing.html');p.locator('#pricingCategory').select_option('shoes');p.locator('#pricingCondition').select_option('good');p.locator('#pricingEstimateBtn').click();assert '$' in p.locator('#pricingEstimateRange').inner_text()
  p.locator('#calcSalePrice').fill('100');p.locator('#calcCogs').fill('20');p.locator('#calcPlatformFeePct').fill('10');p.locator('#calcProfitBtn').click();assert p.locator('#calcNetProfit').inner_text()=='$70.00'
  p.locator('#calcCogs').fill('-20');p.locator('#calcProfitBtn').click();assert 'valid' in p.locator('#calcStatus').inner_text().lower() or 'negative' in p.locator('#calcStatus').inner_text().lower(),'Negative costs accepted'
 def research(p,c):
  calls=[]
  def mock(route):
   query=route.request.post_data_json['query'];calls.append(query)
   route.fulfill(json={'query':query,'searchedAt':'2099-01-01T00:00:00Z','cached':False,'warnings':[],'terms':[{'term':'breathable','listingCount':2}],'listings':[{'title':'Nike Blue Shoes','url':'https://www.ebay.com/itm/123','marketplace':'eBay','snippet':'Sold $45.00','displayedPrice':45,'soldVerified':False}]})
  p.route('**/api/market_research',mock);goto(p);fill(p);p.locator('#runApiResearchBtn').click();p.locator('#compResults a').wait_for();p.locator('#marketTermSuggestions input').check();assert 'breathable' in p.locator('#keywords').input_value();p.locator('#runApiResearchBtn').click();assert len(calls)==1
  p.locator('#compResults input[type=number]').fill('42');p.locator('#compResults input[type=checkbox]').check();p.locator('#compResults button').click();assert float(p.locator('#manualComp1').input_value())==42;p.locator('#applyCompPriceBtn').click();assert p.locator('#price').input_value()=='42.00'
  p.locator('#clearDraftBtn').click();assert p.locator('#marketTermSuggestions').inner_text()=='','Market terms remain after reset'
 def exports(p,c):
  goto(p);fill(p);p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html')
  for button in ['exportBtn','exportJsonBtn']:
   with p.expect_download() as download:p.locator('#'+button).click()
   assert download.value.failure() is None
  p.locator('[data-select-id]').check()
  with p.expect_download() as download:p.locator('#exportSelectedBtn').click()
  assert download.value.failure() is None
 def templateLibrary(p,c):
  goto(p,'templates.html');p.locator('#libraryTemplateName').fill('Test');p.locator('#libraryTemplateDescription').fill('Reusable description');p.locator('#saveLibraryTemplateBtn').click();assert p.locator('[data-edit-template]').count()==1
  p.locator('#duplicateLibraryTemplateBtn').click();assert p.locator('[data-edit-template]').count()==2
  p.locator('#deleteLibraryTemplateBtn').click();assert p.locator('[data-edit-template]').count()==1
  p.locator('#skuStartNumber').fill('10');p.locator('#skuDigits').fill('3');p.locator('#saveSkuSettingsBtn').click();assert '010' in p.locator('#skuPreviewBadge').inner_text()
  p.reload(wait_until='domcontentloaded');assert p.locator('#skuStartNumber').input_value()=='10'
  p.locator('#resetSkuSettingsBtn').click();assert p.locator('#skuStartNumber').input_value()=='1'
 def copies(p,c):
  c.grant_permissions(['clipboard-read','clipboard-write'])
  goto(p);fill(p);p.locator('#copyBtn').click();assert 'Nike' in p.evaluate('navigator.clipboard.readText()')
  p.locator('[data-copy-target="exportHashtags"]').click();assert 'Nike' in p.evaluate('navigator.clipboard.readText()')
 def research_error(p,c):
  p.route('**/api/market_research',lambda route:route.fulfill(status=503,json={'error':'API key missing'}))
  goto(p);fill(p);p.locator('#runApiResearchBtn').click();p.wait_for_function("document.querySelector('#compStatus').textContent.includes('API key missing')")
  assert not p.locator('#runApiResearchBtn').is_disabled();assert p.locator('#runApiResearchBtn').inner_text()=='Research with API'
 def popup_links(p,c):
  goto(p);fill(p);p.evaluate("() => {window.opened=[];window.open=()=>{const tab={location:{}};window.opened.push(tab);return tab;};}")
  p.locator('#runCompSearchBtn').click();urls=p.evaluate('opened.map(tab=>tab.location.href)')
  assert len(urls)==2 and 'LH_Sold=1' in urls[0] and 'availability=sold_out' in urls[1]
  assert not p.locator('#marketSearchLinks').is_visible()
 def draft_identity(p,c):
  goto(p);fill(p);p.locator('#saveDraftBtn').click();p.locator('#clearDraftBtn').click();fill(p);p.locator('#saveDraftBtn').click();assert p.evaluate('getDraftQueue().length')==2,'Separate items overwrite one another'
 def template_storage(p,c):
  goto(p,'templates.html');p.locator('#libraryTemplateName').fill('Test')
  p.evaluate("() => {Storage.prototype.setItem=()=>{throw new Error('storage unavailable')};}")
  p.locator('#saveLibraryTemplateBtn').click();assert 'could not' in p.locator('#templateEditorStatus').inner_text().lower()
 def mobile_navigation(p,c):
  p.set_viewport_size({'width':390,'height':844});goto(p)
  p.locator('.navbar-toggler').click();p.locator('#primaryNav').wait_for(state='visible')
  p.locator('.menu-toggle').click();p.locator('.dropdown-menu a[href="about.html"]').click();p.wait_for_url('**/about.html')
  p.locator('.navbar-toggler').click();p.locator('#primaryNav a[href="new-listing.html?new=1"]').click();p.wait_for_url('**/new-listing.html?new=1')
 def dashboard_actions(p,c):
  goto(p);fill(p);p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html')
  p.locator('[data-dup]').click();assert p.locator('#listingsTableBody tr').count()==2
  skus=p.locator('.dashboard-sku').all_inner_texts();assert len(set(skus))==2
  p.locator('#statusFilter').select_option('draft');assert p.locator('#listingsTableBody tr').count()==1
  p.locator('#statusFilter').select_option('all');p.locator('#selectAllListings').check();assert p.locator('[data-select-id]:checked').count()==2
  p.once('dialog',lambda dialog:dialog.accept());p.locator('[data-del]').first.click();assert p.locator('#listingsTableBody tr').count()==1
  p.locator('.dashboard-item-title').click();p.wait_for_url('**/listing.html?id=*');assert 'Nike' in p.locator('#detailExport').inner_text()
  p.once('dialog',lambda dialog:dialog.accept());p.locator('#detailDeleteBtn').click();p.wait_for_url('**/dashboard.html');assert p.locator('#listingsTableBody tr').count()==0
 def fill_sku(p,value):
  section=p.locator('details').filter(has=p.locator('#itemSku'))
  if section.get_attribute('open') is None:section.locator('summary').click()
  p.locator('#itemSku').fill(value)
 def item_skus(p,c):
  goto(p);fill(p);fill_sku(p,'0099');p.locator('#saveDraftBtn').click();p.locator('#clearDraftBtn').click();p.locator('#loadDraftBtn').click();assert p.locator('#itemSku').input_value()=='0099'
  p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('.dashboard-sku').inner_text()=='0099';assert p.evaluate('getSkuSettings().nextNumber')==1
  p.locator('[data-edit]').click();p.wait_for_url('**/new-listing.html');assert p.locator('#itemSku').input_value()=='0099';fill_sku(p,'0042');p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('.dashboard-sku').inner_text()=='0042';assert p.evaluate('getSkuSettings().nextNumber')==1
  goto(p);fill(p);fill_sku(p,'0042');p.locator('#listingForm button[type=submit]').click();assert 'already assigned' in p.locator('#formError').inner_text()
  fill_sku(p,'');p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('.dashboard-sku').first.inner_text()=='0001';assert p.evaluate('getSkuSettings().nextNumber')==2
  p.locator('[data-edit]').first.click();p.wait_for_url('**/new-listing.html');fill_sku(p,'');p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('.dashboard-sku').all_inner_texts()==['0002','0042']
  assert 'SKU: 0002' in p.evaluate('buildExportSummary(getListings()[0])')
 def content_typography(p,c):
  goto(p)
  readings=p.evaluate("""() => {
    const samples=['main h1','main .form-label','main .form-control','main .btn','main .small','footer p'];
    const sizes=()=>samples.map(selector=>parseFloat(getComputedStyle(document.querySelector(selector)).fontSize));
    const menu=document.querySelector('nav.navbar .nav-link');
    const menuBefore=getComputedStyle(menu).fontSize;
    const reduced=sizes();
    document.querySelectorAll('main,body > footer').forEach(el=>el.style.setProperty('--ll-content-text-step','0pt'));
    const original=sizes();
    const menuAfter=getComputedStyle(menu).fontSize;
    return {reduced,original,menuBefore,menuAfter};
  }""")
  assert readings['menuBefore']==readings['menuAfter'],'Menu text changed'
  for old,new in zip(readings['original'],readings['reduced']):
   assert abs((old-new)-(8/3))<0.05,f'Text change was {old-new}px, expected two points'
 def platform_exports(p,c):
  goto(p);fill(p);p.locator('#price').fill('45.99');p.locator('summary').filter(has_text='Additional Details').click();p.locator('#keyFeatures').fill('Cushioned, Breathable, Lace-up, Running')
  p.locator('#exportPlatform').select_option('poshmark');assert p.locator('#exportPrice').inner_text()=='46';assert p.locator('#exportTagsLabel').text_content()=='Style Tags';assert len(p.locator('#exportHashtags').inner_text().split(', '))==3
  p.locator('#notes').fill('x'*1700);assert len(p.locator('#exportDescription').inner_text())==1500;assert '1,500' in p.locator('#exportCompatibilityStatus').inner_text()
  with p.expect_download() as download:p.locator('#downloadFormFieldsBtn').click()
  assert 'poshmark' in download.value.suggested_filename
  p.locator('#exportPlatform').select_option('ebay');assert p.locator('#exportPrice').inner_text()=='45.99';assert len(p.locator('#exportDescription').inner_text())>=1700
  p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');p.locator('#dashboardTools > summary').click();p.locator('#dashboardExportPlatform').select_option('poshmark')
  with p.expect_download() as download:p.locator('#exportBtn').click()
  import csv
  with open(download.value.path(),encoding='utf-8-sig',newline='') as handle:rows=list(csv.DictReader(handle))
  assert rows[0]['Listing Price']=='46' and rows[0]['Availability']=='Draft';assert rows[0]['Style Tag 1']=='Cushioned'
 def purple_theme(p,c):
  for file in ROOT.glob('*.html'):
   if file.name=='dashboard.html':continue  # Dashboard intentionally retains its original theme.
   goto(p,file.name)
   mismatches=p.evaluate("""() => {
    const expected='rgb(45, 7, 29)';
    const headings=Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6,.h1,.h2,.h3,.h4,.h5,.h6,.form-label,summary,.preview-section-label'));
    const buttons=Array.from(document.querySelectorAll('.btn'));
    return [...headings.filter(el=>getComputedStyle(el).color!==expected).map(el=>'heading '+el.textContent.slice(0,40)),
      ...buttons.filter(el=>getComputedStyle(el).backgroundColor!==expected || getComputedStyle(el).color!=='rgb(255, 255, 255)').map(el=>'button '+el.textContent.slice(0,40))];
   }""")
   assert not mismatches,file.name+': '+str(mismatches)
  goto(p,'index.html');p.screenshot(path='/tmp/listinglab-purple-home.png')
 def inventory_recovery(p,c):
  goto(p);p.evaluate("() => {addListing({id:'original-one',itemName:'Original One',sku:'0001',status:'listed'});addListing({id:'original-two',itemName:'Original Two',sku:'0002',status:'listed'});}")
  goto(p,'dashboard.html');p.once('dialog',lambda d:d.accept());p.locator('[data-del]').first.click();assert p.locator('#listingsTableBody tr').count()==1
  p.locator('summary').filter(has_text='Export & Backups').click();p.locator('#recoverInventoryBtn').click();assert p.locator('#listingsTableBody tr').count()==2
  assert p.locator('[data-status-id]').evaluate_all('(els)=>els.every(el=>el.value==="listed")')
  with p.expect_download() as download:p.locator('#saveInventoryBackupBtn').click()
  inventory=json.loads(Path(download.value.path()).read_text());assert len(inventory)==2
  p.locator('#inventoryBackupFile').set_input_files({'name':'inventory.json','mimeType':'application/json','buffer':json.dumps(inventory).encode()});p.wait_for_function("document.querySelector('#dashboardStatus').textContent.includes('0 listings imported')")
  assert p.locator('#listingsTableBody tr').count()==2
 def original_dashboard(p,c):
  goto(p,'dashboard.html')
  assert p.evaluate("getComputedStyle(document.documentElement).fontSize")=='16px'
  assert p.locator('.dashboard-header #dashboardExportPlatform').count()==0
  assert p.locator('#dashboardTools #dashboardExportPlatform').count()==1
  assert p.locator('#exportSelectedBtn').evaluate("el=>getComputedStyle(el).backgroundColor")=='rgba(255, 255, 255, 0.92)'
  assert p.locator('#dashboardTools').evaluate("el=>!el.open")
  p.screenshot(path='/tmp/listinglab-dashboard-restored.png')
  p.locator('#dashboardTools > summary').click();assert p.locator('#recoverInventoryBtn').is_visible()
 def pricing_handoff_export(p,c):
  goto(p);fill(p);p.locator('#itemName').fill('Nike Air Max Sneakers');p.locator('#color').fill('Blue');fill_sku(p,'000777');p.locator('#notes').fill('Small heel scuff. Heel measurement 1 inch.')
  p.locator('#openPricingCalculatorBtn').click();p.wait_for_url('**/pricing.html?context=*');assert p.locator('#pricingBrand').input_value()=='Nike'
  values={'calcSalePrice':'','calcCogs':'20','calcShippingCost':'5','calcPackagingCost':'2','calcFixedFee':'0.30','calcAdCost':'1','calcPlatformFeePct':'15','calcPaymentFeePct':'3','calcMinimumProfit':'5','calcTargetProfit':'15','calcTargetMargin':'30','calcOfferRoom':'20','calcMileage':'10','calcMileageRate':'0.70'}
  for id,value in values.items():p.locator('#'+id).fill(value)
  p.locator('#calcProfitBtn').click();assert p.locator('#calcListingPrice').inner_text()=='$84.87';assert p.locator('#calcMinSale').inner_text()=='$49.15';assert p.locator('#calcTargetPrice').inner_text()=='$67.89'
  p.locator('#applyPricingToListingBtn').click();p.wait_for_url('**/new-listing.html?pricing=*');assert p.locator('#itemName').input_value()=='Nike Air Max Sneakers';assert p.locator('#itemSku').input_value()=='000777';assert p.locator('#notes').input_value()=='Small heel scuff. Heel measurement 1 inch.';assert p.locator('#price').input_value()=='84.87'
  assert '49.15' in p.locator('#listingPricingSummary').inner_text();assert p.locator('#suggestedRange').count()==0
  p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('h1').inner_text()=='Inventory Dashboard'
  p.locator('#dashboardTools > summary').click();p.locator('#dashboardExportPlatform').select_option('spreadsheet')
  with p.expect_download() as download:p.locator('#exportSpreadsheetBtn').click()
  exported=Path('/tmp/listinglab-pricing-export.xlsx');download.value.save_as(exported)
  from zipfile import ZipFile
  from xml.etree import ElementTree as E
  ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
  with ZipFile(exported) as z:
   assert z.testzip() is None
   for name in z.namelist():
    if name.endswith(('.xml','.rels')):E.fromstring(z.read(name))
   sheet=E.fromstring(z.read('xl/worksheets/sheet1.xml'));cells={cell.attrib['r']:cell for cell in sheet.findall('.//s:sheetData/s:row/s:c',ns)}
   assert cells['A3'].attrib['t']=='inlineStr' and cells['A3'].findtext('s:is/s:t',namespaces=ns)=='000777'
   assert cells['P3'].findtext('s:v',namespaces=ns)=='49.15' and cells['Q3'].findtext('s:v',namespaces=ns)=='67.89'
   assert cells['R3'].find('s:v',ns) is None and cells['Z3'].findtext('s:v',namespaces=ns)==''
   headers=[cell.findtext('s:is/s:t',namespaces=ns) for cell in sheet.findall('s:sheetData/s:row[@r="2"]/s:c',ns)]
   expected=p.evaluate('RESELLER_OVERVIEW_HEADERS');assert headers==expected
  p.locator('[data-status-id]').select_option('listed');p.locator('[data-edit]').click();p.wait_for_url('**/new-listing.html');p.locator('#openPricingCalculatorBtn').click();p.wait_for_url('**/pricing.html?context=*');p.locator('#calcOfferRoom').fill('0');p.locator('#calcProfitBtn').click();p.locator('#applyPricingToListingBtn').click();p.wait_for_url('**/new-listing.html?pricing=*');p.locator('#listingForm button[type=submit]').click();p.wait_for_url('**/dashboard.html');assert p.locator('#listingsTableBody tr').count()==1 and p.locator('[data-status-id]').input_value()=='listed'
 def research_title_validation(p,c):
  calls=[]
  def mock(route):
   data=route.request.post_data_json;calls.append(data['query']);route.fulfill(json={'query':data['query'],'searchedAt':'2026-10-28T00:00:00Z','warnings':[],'listings':[],'terms':[]})
  p.route('**/api/market_research',mock);goto(p);p.locator('#runApiResearchBtn').click();assert 'Enter an item title' in p.locator('#compStatus').inner_text()
  p.locator('#itemName').fill('New Balance Numeric Shoes');p.locator('#runApiResearchBtn').click();p.wait_for_function("!document.querySelector('#runApiResearchBtn').disabled");assert calls==['New Balance Numeric Shoes']
 def static_backend_error(p,c):
  p.route('**/api/market_research',lambda route:route.fulfill(status=405,body='Not allowed',content_type='text/html'))
  goto(p);p.locator('#itemName').fill('Nike Air Max');p.locator('#runApiResearchBtn').click();p.wait_for_function("document.querySelector('#compStatus').textContent.includes('This preview cannot run API research')")
 def related_research_retry(p,c):
  calls=[]
  def mock(route):
   query=route.request.post_data_json['query'];calls.append(query)
   listings=[] if len(calls)==1 else [{'title':'Air Zoom Pegasus Sneakers','url':'https://www.ebay.com/itm/123','marketplace':'eBay','snippet':'Nike running shoes, listing lead','matchType':'related','soldVerified':False,'displayedPrice':None}]
   route.fulfill(json={'query':query,'searchedAt':'2099-01-01T00:00:00Z','warnings':[],'listings':listings,'terms':[]})
  p.route('**/api/market_research',mock);goto(p);p.locator('#itemName').fill('Nike Air Max Shoes');p.locator('#runApiResearchBtn').click();p.wait_for_function("document.querySelector('#compStatus').textContent.includes('no usable listing results')")
  p.locator('#runApiResearchBtn').click();p.locator('#compResults a').wait_for();assert len(calls)==2,'Empty search must not block retries'
  assert 'Related listing' in p.locator('#compResults a').text_content();p.locator('#runApiResearchBtn').click();assert len(calls)==2,'Nonempty results should still reuse research'
 def required_research_fields(p,c):
  sent=[]
  def mock(route):
   data=route.request.post_data_json;sent.append(data)
   route.fulfill(json={'query':data['query'],'searchQuery':data['searchQuery'],'searchedAt':'2099-01-01T00:00:00Z','warnings':[],
    'listings':[{'title':'New Balance 420 sneakers','url':'https://ebay.com/itm/420','marketplace':'eBay','snippet':'Related sneakers','matchType':'related','soldVerified':False},
     {'title':'New Balance 440 V2 sneakers','url':'https://ebay.com/itm/440','marketplace':'eBay','snippet':'Related sneakers','matchType':'related','soldVerified':False}], 'terms':[]})
  p.route('**/api/market_research',mock);goto(p);p.locator('#itemName').fill('New Balance sneakers');p.locator('#brand').fill('New Balance');p.locator('#category').select_option('shoes');p.locator('summary').filter(has_text='Additional Details').click();p.locator('#productType').fill('boots');p.locator('#styleModel').fill('440 V2');p.locator('#material').fill('suede');p.locator('#runApiResearchBtn').click();p.locator('#compResults a').first.wait_for()
  assert sent[0]['searchQuery']=='New Balance sneakers';assert p.locator('#compResults a').count()==2
  assert '420' in p.locator('#compResults a').first.text_content()
  p.locator('#brand').fill('');p.locator('#category').select_option('');p.locator('#styleModel').fill('different optional model');p.locator('#runApiResearchBtn').click();assert len(sent)==1,'Other fields must not change research or its cache'
 for name,fn in [('pages and responsive layouts',smoke),('deep purple theme consistency',purple_theme),('content typography and menu consistency',content_typography),('fresh navigation and draft load',fresh),('manual comp median and persistence',comps),('all photo categories and tracking',photos),('description regeneration',description),('template substitution and keyword merge',template),('save/edit/status preservation',edit),('dashboard product search',search),('storage failure handling',storage),('pricing and cost validation',pricing),('pricing handoff and spreadsheet export',pricing_handoff_export),('research title validation',research_title_validation),('required research fields and soft refinement',required_research_fields),('related research results and retry',related_research_retry),('static research backend error',static_backend_error),('API UI, caching and reset',research),('CSV JSON selected exports',exports),('platform form exports and copy fields',platform_exports),('template CRUD and SKU settings',templateLibrary),('per-item SKU edits and auto sequence',item_skus),('clipboard copy buttons',copies),('API error recovery',research_error),('marketplace sold links and tabs',popup_links),('distinct draft identities',draft_identity),('inventory backup recovery and import',inventory_recovery),('template storage failure',template_storage),('mobile navigation dropdowns',mobile_navigation),('dashboard CRUD selection and detail',dashboard_actions),('original dashboard appearance',original_dashboard)]:
  if len(sys.argv)<2 or sys.argv[1] in name:run(name,fn)
 browser.close()
http.shutdown()
Path('/tmp/listinglab-audit-results.json').write_text(json.dumps(results,indent=2))
print(f"{sum(item['passed'] for item in results)}/{len(results)} browser workflows passed.")
sys.exit(0 if all(item['passed'] for item in results) else 1)
