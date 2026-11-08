import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertOperation, assertTarget } from './nodia-ai-ai41-r2-cleanup.integration.mjs';

const target={
  chat_id:'5c12b601-e1d8-43d3-b957-050e5ea3b6f1',
  attachment_id:'f68020bd-4f37-4946-9415-12ce3cc6c38a',
  generation:'3c262413-8558-4678-9361-c5e0c893bb70',
};
const key=`nodia-ai/${target.chat_id}/${target.attachment_id}/${target.generation}`;

test('only the persisted immutable object triple is allowed',()=>{
  assert.doesNotThrow(()=>assertTarget(target,key));
  for(const foreign of [
    `fixture/${key}`,
    key.replace(target.chat_id,'53171d12-a173-4e4e-8e49-740208092fe5'),
    key.replace(target.attachment_id,'53171d12-a173-4e4e-8e49-740208092fe5'),
    key.replace(target.generation,'53171d12-a173-4e4e-8e49-740208092fe5'),
    `${key}/version`,
  ])assert.throws(()=>assertTarget(target,foreign));
  assert.throws(()=>assertTarget({...target,generation:'../anything'},key));
});

test('the R2 transport blocks listing, other resources and batch deletion',()=>{
  for(const command of ['PutObjectCommand','HeadObjectCommand','GetObjectCommand','DeleteObjectCommand']){
    assert.doesNotThrow(()=>assertOperation(target,command,{Key:key}));
    assert.throws(()=>assertOperation(target,command,{Key:`${key}-foreign`}));
  }
  for(const command of ['ListObjectsV2Command','DeleteObjectsCommand','ListObjectVersionsCommand','GetBucketLifecycleConfigurationCommand'])
    assert.throws(()=>assertOperation(target,command,{Key:key}));
});
