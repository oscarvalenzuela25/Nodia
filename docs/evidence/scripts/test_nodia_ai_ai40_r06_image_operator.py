"""Atomic qualifier receipt gates, using explicitly synthetic transport metadata."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('qualifier',Path(__file__).with_name('nodia-ai-ai40-r06-image-operator-r01.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ReceiptGates(unittest.TestCase):
    def setUp(self):
        self.selection={'connection_id':'1','mode':'token_plan_agentic','model_id':'synthetic-observed-model','effort_id':None}
        self.probe={'media_type':'image/png','sha256':'a'*64}
        self.parent={'schema':'nodia-ai-ai40-real-canary-parent-v1','status':'passed','fixture_resources_removed':True,'retained_disposable_container':None,'child_exit_code':0,'child_exit_signal':None,'child_timed_out':False,'operational_database_accessed':False,'operational_profile_removed':False,'child':{'schema':'nodia-ai-ai40-real-canary-v1','status':'passed','selection':self.selection,'acceptance_kind':'image_original','image_media_type':'image/png','image_source_sha256':'a'*64,'provider_dispatches_armed':1,'gateway_callbacks':0,'run_state':'completed','assistant_message_sealed':False,'initial_mcp_accepted':True,'final_mcp_accepted':True,'final_verified_image_media_types':['image/png'],'readiness_overridden':False,'executable_overridden':False,'publication_overridden':False,'operational_database_accessed':False,'operational_profile_removed':False,'terminal_proof_id':'11111111-1111-4111-8111-111111111111','response_sha256':'b'*64}}
    def test_complete_closed_image_transport_can_pass(self):
        self.assertTrue(module.validate_parent(self.parent,0,self.selection,self.probe))
    def test_nonzero_process_or_failed_child_never_passes(self):
        self.assertFalse(module.validate_parent(self.parent,1,self.selection,self.probe))
        self.parent['child']['status']='failed';self.assertFalse(module.validate_parent(self.parent,0,self.selection,self.probe))
    def test_wrong_mime_cannot_qualify_another_format(self):
        self.parent['child']['image_media_type']='image/jpeg'
        with self.assertRaisesRegex(ValueError,'image_semantics_invalid'):module.validate_parent(self.parent,0,self.selection,self.probe)
    def test_second_dispatch_or_callback_cannot_hide_in_a_passed_receipt(self):
        for field in ('provider_dispatches_armed','gateway_callbacks'):
            p=copy.deepcopy(self.parent);p['child'][field]=2
            with self.assertRaisesRegex(ValueError,'image_semantics_invalid'):module.validate_parent(p,0,self.selection,self.probe)
    def test_readiness_override_or_operational_database_access_is_rejected(self):
        for field in ('readiness_overridden','operational_database_accessed'):
            p=copy.deepcopy(self.parent);p['child'][field]=True
            with self.assertRaisesRegex(ValueError,'image_authority_invalid'):module.validate_parent(p,0,self.selection,self.probe)
    def test_retained_disposable_resources_fail_success_cleanup(self):
        self.parent['fixture_resources_removed']=False
        with self.assertRaisesRegex(ValueError,'parent_cleanup_invalid'):module.validate_parent(self.parent,0,self.selection,self.probe)
    def test_lost_MCP_or_selection_change_cannot_be_accepted(self):
        for field,value in (('final_mcp_accepted',False),('selection',{**self.selection,'effort_id':'synthetic-changed'})):
            p=copy.deepcopy(self.parent);p['child'][field]=value
            with self.assertRaisesRegex(ValueError,'image_semantics_invalid'):module.validate_parent(p,0,self.selection,self.probe)

if __name__=='__main__':unittest.main()
