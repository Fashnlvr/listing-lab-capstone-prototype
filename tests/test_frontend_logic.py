"""Frontend regression tests using macOS's built-in JavaScriptCore (no API credits)."""
import ctypes
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(sys.platform == "darwin", "JavaScriptCore checks require macOS; use browser_audit.py elsewhere")
class FrontendTests(unittest.TestCase):
    def setUp(self):
        self.lib = ctypes.CDLL("/System/Library/Frameworks/JavaScriptCore.framework/JavaScriptCore")
        ptr = ctypes.c_void_p
        signatures = {
            "JSGlobalContextCreate": ([ptr], ptr),
            "JSGlobalContextRelease": ([ptr], None),
            "JSStringCreateWithUTF8CString": ([ctypes.c_char_p], ptr),
            "JSStringRelease": ([ptr], None),
            "JSEvaluateScript": ([ptr, ptr, ptr, ptr, ctypes.c_int, ctypes.POINTER(ptr)], ptr),
            "JSValueToStringCopy": ([ptr, ptr, ptr], ptr),
            "JSStringGetUTF8CString": ([ptr, ctypes.c_char_p, ctypes.c_size_t], ctypes.c_size_t),
        }
        for name, (args, result) in signatures.items():
            fn = getattr(self.lib, name)
            fn.argtypes, fn.restype = args, result
        self.context = self.lib.JSGlobalContextCreate(None)
        self.evaluate("""
            var window = {};
            var document = {addEventListener(){}};
            var data = new Map();
            var localStorage = {
              getItem(key){return data.get(key) || null},
              setItem(key,value){data.set(key,String(value))},
              removeItem(key){data.delete(key)}
            };
            function check(value,message){if(!value)throw Error(message)}
        """ + (ROOT / "script.js").read_text())

    def tearDown(self):
        self.lib.JSGlobalContextRelease(self.context)

    def evaluate(self, code):
        source = self.lib.JSStringCreateWithUTF8CString(code.encode())
        error = ctypes.c_void_p()
        self.lib.JSEvaluateScript(self.context, source, None, None, 1, ctypes.byref(error))
        self.lib.JSStringRelease(source)
        if error.value:
            message = self.lib.JSValueToStringCopy(self.context, error, None)
            buffer = ctypes.create_string_buffer(8192)
            self.lib.JSStringGetUTF8CString(message, buffer, len(buffer))
            self.lib.JSStringRelease(message)
            self.fail(buffer.value.decode())

    def test_template_tokens_and_literal_prose(self):
        self.evaluate("""
            check(renderTemplateTokens('{{brand}} {itemName}', {brand:'Nike',itemName:'Blue'})==='Nike Blue','brace tokens');
            check(renderTemplateTokens('Brand Item Name', {brand:'Nike',itemName:'Blue'})==='Nike Blue','legacy tokens');
            check(renderTemplateTokens('Check the brand label', {brand:'Nike'})==='Check the brand label','literal prose');
        """)

    def test_listing_crud_status_and_skus(self):
        self.evaluate("""
            check(addListing({id:'a',brand:'Nike',itemName:'Blue',status:'sold',sku:'0001'}),'add');
            check(updateListing('a',{price:45}),'update');
            check(getListingById('a').status==='sold','status preserved');
            check(allocateNextSku()==='0002','existing SKU collision avoided');
            var copy=duplicateListing('a');
            check(copy.status==='draft' && copy.sku!=='0001','duplicate');
            check(copy.itemName==='Blue','duplicate preserves actual color');
            check(removeListing('a') && !getListingById('a'),'delete');
        """)

    def test_numeric_skus_and_item_overrides(self):
        self.evaluate("""
            localStorage.setItem(STORAGE_KEYS.skuSettings, JSON.stringify({prefix:'OLD',nextNumber:42,digits:5}));
            check(formatCustomSku(42)==='00042','prefix ignored, sequence and digits retained');
            check(addListing({id:'one',sku:'CUSTOM-7'}),'custom item save');
            check(!isSkuAvailable('custom-7'),'case-insensitive duplicate check');
            check(isSkuAvailable('CUSTOM-7','one'),'same item can keep SKU');
            check(updateListing('one',{sku:'00999'}),'per-item edit');
            check(getSkuSettings().nextNumber===42,'manual change leaves sequence alone');
            check(getListingById('one').sku==='00999','leading zeros retained');
            check(buildExportSummary(getListingById('one')).includes('SKU: 00999'),'summary export');
        """)

    def test_distinct_drafts_and_legacy_recovery(self):
        self.evaluate("""
            check(saveDraft({__draftId:'one',itemName:'Blue',manualComps:['30','50']}),'save first');
            check(saveDraft({__draftId:'two',itemName:'Blue'}),'save second');
            check(getDraftQueue().length===2,'identical items stay separate');
            saveDraft({__draftId:'one',itemName:'Blue',manualComps:['40']});
            check(getDraftQueue().length===2 && loadDraft().manualComps[0]==='40','draft updates');
            localStorage.setItem(STORAGE_KEYS.draft,JSON.stringify({itemName:'Legacy'}));
            check(loadDraft().itemName==='Legacy','legacy draft recovery');
        """)

    def test_inventory_backups_recover_missing_records_without_overwriting(self):
        self.evaluate("""
            addListing({id:'one',itemName:'First',sku:'0001',status:'listed'});
            addListing({id:'two',itemName:'Second',sku:'0002',status:'listed'});
            updateListing('one',{status:'sold'});
            removeListing('two');
            const recovered=mergeInventoryRecords(getListings(),getRecoverableInventory());
            check(recovered.added===1,'recover missing listing');
            check(recovered.listings.find(item=>item.id==='one').status==='sold','current record retained');
            check(recovered.listings.find(item=>item.id==='two').status==='listed','listed status retained');
            check(saveListings(recovered.listings) && getListings().length===2,'recovery saved');
            const conflict=mergeInventoryRecords(getListings(),[{id:'new',itemName:'Conflict',sku:'0001',status:'listed'}]);
            check(conflict.added===0 && conflict.listings.length===2,'duplicate SKU cannot overwrite inventory');
        """)

    def test_price_targets_cover_costs_fees_profit_margin_and_offers(self):
        self.evaluate("""
            const plan=calculateResalePricing({cogs:20,shipping:5,packaging:2,fixedFee:0.3,adCost:1,
              platformFeePct:15,paymentFeePct:3,mileage:10,mileageRate:0.7,minimumProfit:5,targetProfit:15,targetMarginPct:30,offerRoomPct:20});
            check(Math.abs(plan.totalFixedCosts-35.3)<1e-8,'all fixed costs and mileage');
            check(plan.minSale===49.15 && plan.targetPrice===67.89 && plan.listPrice===84.87,'minimum target and list calculations');
            check(plan.minSale*(1-plan.feeRate)-plan.totalFixedCosts>=5,'minimum profit protected');
            check(plan.marginPct>=30 && plan.netProfit>=15,'both margin and profit targets');
            check(plan.listPrice*0.8>=plan.targetPrice,'offer room preserves target');
            check(calculateResalePricing({salePrice:100,cogs:20,platformFeePct:10}).netProfit===70,'planned sale analysis');
            check(calculateResalePricing({targetProfit:10}).roiPct===null,'free item ROI unavailable');
        """)

    def test_price_target_validation(self):
        self.evaluate("""
            for(const inputs of [{cogs:-1},{offerRoomPct:100},{platformFeePct:20,targetMarginPct:80},{mileage:Infinity},{cogs:1e308,mileage:1e308,mileageRate:100}]){
              let rejected=false;try{calculateResalePricing(inputs)}catch{rejected=true}check(rejected,'invalid pricing rejected');
            }
            const plan=calculateResalePricing({cogs:20,targetProfit:5,minimumProfit:15});
            check(plan.targetPrice>=plan.minSale && plan.listPrice>=plan.targetPrice,'ordered targets');
        """)

    def test_spreadsheet_export_matches_overview_and_leaves_sales_blank(self):
        self.evaluate("""
            const pricingPlan=calculateResalePricing({cogs:20,platformFeePct:20,targetProfit:20,offerRoomPct:20});
            const item={id:'sheet',sku:'000001',itemName:'Example item',status:'listed',price:pricingPlan.listPrice,pricingPlan};
            const row=resellerSpreadsheetRow(item);
            check(Object.keys(row).length===28 && RESELLER_OVERVIEW_HEADERS[15]==='Min Sale' && RESELLER_OVERVIEW_HEADERS[16]==='Target Price','exact overview columns');
            check(row['SKU #']==='000001' && row['List Price']===62.5 && row['Target Price']===50,'pricing export');
            check(row['Sold Price']==='' && row['Platform Fee']==='' && row.Profit==='','no invented sales');
            const sold=resellerSpreadsheetRow({...item,soldPrice:50,platformFee:7});
            check(sold['Total Cost']===27 && sold.Profit===23,'actual fee overrides estimate');
            check(!marketplaceFormSummary(item,'flyp').includes('Target Net Margin'),'private pricing excluded from buyer fields');
        """)

    def test_failed_storage_writes_are_reported(self):
        self.evaluate("""
            localStorage.setItem=()=>{throw Error('quota exceeded')};
            check(!saveDraft({itemName:'Blue'}),'draft failure');
            check(!addListing({id:'a'}),'listing failure');
            check(!upsertTemplate({id:'a',name:'Test'}),'template failure');
            check(allocateNextSku()===null,'SKU failure');
        """)

    def test_corrupt_storage_does_not_crash(self):
        self.evaluate("""
            localStorage.setItem(STORAGE_KEYS.listings,'not JSON');
            check(getListings().length===0,'invalid JSON');
            localStorage.setItem(STORAGE_KEYS.templates,'[null,17,{"id":"ok"}]');
            check(getTemplates().length===1,'bad template records');
            localStorage.setItem(STORAGE_KEYS.draft,'[null,false,17,{"itemName":"ok"}]');
            check(getDraftQueue().length===1,'bad draft records');
        """)

    def test_search_relevance_and_confirmed_market_wording(self):
        self.evaluate("""
            var state={brand:'Nike',productType:'shoes',itemName:'Nike blue shoes',color:'Blue',material:'Mesh',keyFeatures:'Lace up',gender:'Unisex',size:'8',researchTerms:['breathable']};
            var suggestions=buildSearchSuggestions(state);
            check(suggestions.keywords.includes('Blue shoes'),'color phrase');
            check(suggestions.keywords.includes('breathable'),'confirmed market term');
            check(suggestions.keywords.length>15,'richer suggestions');
            check(!suggestions.hashtags.includes('#'),'plain tags');
            check(!buildSearchSuggestions({category:'shoes',condition:'new'}).keywords.join(' ').includes('nwt'),'no invented tags');
        """)

    def test_export_attributes_and_title_limits(self):
        self.evaluate("""
            var listing={brand:'Nike',productType:'Running Shoes',styleModel:'Air Max 90',itemName:'Blue',material:'Mesh',size:'8',notes:'Small heel scuff'};
            var map=getMarketplaceMap(listing);
            check(map.poshmark.size==='8','size export');
            check(map.ebay.description==='Small heel scuff' && map.ebay.material==='Mesh','editable copy and structured details');
            check(buildExportSummary(listing).includes('Tagged size: 8'),'summary attributes');
            var long=getMarketplaceMap({...listing,itemName:'Nike Running Shoes Air Max 90 Blue Mesh Unisex Size 8 Cushioned Lightweight Lace Up Athletic',keyFeatures:'Breathable cushioned lightweight lace up everyday running athletic shoes'});
            check(long.poshmark.title.length>50 && long.poshmark.title.length<=80,'Poshmark 80 character title');
        """)

    def test_title_is_not_treated_as_color(self):
        self.evaluate("""
            const item={itemName:'Nike Air Max Blue Running Shoes Size 8',brand:'Nike',color:'Blue',size:'8'};
            check(buildListingTitle(item)===item.itemName,'entered title stays intact');
            check(getMarketplaceMap(item).poshmark.color==='Blue','color uses its own field');
            check(getMarketplaceMap({itemName:'Nike Running Shoes'}).flyp.color==='','title not copied as color');
        """)

    def test_description_is_natural_copy_without_invented_promises(self):
        self.evaluate("""
            const item={brand:'Nike',productType:'running shoes',styleModel:'Air Max 90',color:'blue',size:'8',material:'mesh',
              keyFeatures:'lace-up closure, cushioned footbed',condition:'good'};
            const text=composeListingDescription(item);
            check(text.includes('Nike running shoes (Air Max 90) in blue.'),'natural opening');
            check(text.includes('Made from mesh.') && text.includes('lace-up closure and cushioned footbed'),'features as prose');
            check(text.includes('good pre-owned condition'),'condition');
            check(!text.includes('Brand:') && !text.includes('Material:'),'no field dump');
            check(!text.includes('Ships') && !text.includes('flawless') && !text.includes('tags'),'no invented claims');
            check(buildMarketplaceDescription({...item,notes:'Small scuff on left heel.'})==='Small scuff on left heel.','seller description preserved');
            check(composeListingDescription({})==='','empty input');
        """)

    def test_platform_form_fields_and_limits(self):
        self.evaluate("""
            const listing={id:'one',sku:'0007',brand:'Nike',productType:'Shoes',itemName:'Blue',condition:'new',price:45.99,
              keyFeatures:'Cushioned, Breathable, Lace-up, Running',material:'Mesh',notes:'x'.repeat(1700)};
            const map=getMarketplaceMap(listing);
            check(map.poshmark.description.length===1500,'Poshmark description limit');
            check(map.poshmark.styleTags.length===3 && map.poshmark.styleTags.every(tag=>tag.length<=25),'Poshmark style tag limits');
            check(map.poshmark.listingPrice==='46','whole dollar price');
            check(map.poshmark.originalPrice==='' && map.poshmark.condition==='','no invented original price or NWT');
            check(map.flyp.description.length>=1700 && map.ebay.price==='45.99','other form precision');
            check(marketplaceFormFields(listing,'poshmark')['Availability']==='Draft','draft export');
            check(marketplaceCSV([listing],'poshmark').includes('Style Tag 1'),'platform CSV headers');
            check(!marketplaceCSV([listing],'ebay').includes('poshmark_'),'separate platform fields');
            check(marketplaceExportIssues(listing,'poshmark').length>=2,'visible adjustments');
        """)

    def test_general_research_uses_required_fields_not_optional_details(self):
        self.evaluate("""
            const state={itemName:'New Balance sneakers',brand:'New Balance',category:'shoes',
              productType:'boots',styleModel:'440 V2',material:'suede',color:'Olivine',size:'11',keyFeatures:'rare embroidered logo'};
            check(buildGeneralResearchQuery(state)==='New Balance sneakers','required fields drive broad query');
            check(buildGeneralResearchQuery({itemName:'New Balance sneakers'})==='New Balance sneakers','title alone works');
            check(buildGeneralResearchQuery({...state,brand:'Nike',category:'bags'})==='New Balance sneakers','other fields ignored');
            check(buildGeneralResearchQuery({...state,itemName:''})==='','optional fields cannot replace title');
            check(buildGeneralResearchQuery({...state,itemName:'New Balance 440 V2 sneakers'})==='New Balance 440 V2 sneakers','title model preserved');
        """)

    def test_research_empty_message_distinguishes_missing_and_filtered_results(self):
        self.evaluate("""
            check(researchEmptyMessage({diagnostics:[{returned:0},{returned:0}]}).includes('clear sold status'),'provider empty');
            check(researchEmptyMessage({diagnostics:[{returned:5},{returned:3}]}).includes('8 pages'),'filtered results');
            check(researchEmptyMessage({}).includes('no usable listing results'),'older backend supported');
        """)

    def test_marketplace_searches_target_sold_items(self):
        self.evaluate("""
            var links=buildResearchLinks('Nike blue shoes & boots');
            check(links.ebaySold.includes('LH_Sold=1') && links.ebaySold.includes('%26'),'eBay sold search and encoding');
            check(links.poshmark.includes('availability=sold_out'),'Poshmark sold filter');
        """)

    def test_all_photo_categories_have_complete_checklists(self):
        self.evaluate("""
            check(Object.keys(PHOTOGRAPHY_CATEGORIES).length===12,'twelve categories');
            for(const guide of Object.values(PHOTOGRAPHY_CATEGORIES)){
              check(guide.shots.length>=9 && guide.count && guide.label,'complete category');
            }
        """)


if __name__ == "__main__":
    unittest.main()
