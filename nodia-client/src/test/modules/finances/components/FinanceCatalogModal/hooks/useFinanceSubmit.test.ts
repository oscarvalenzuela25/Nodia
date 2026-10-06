import {act,renderHook} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import {useFinanceSubmit} from '../../../../../../modules/finances/components/FinanceCatalogModal/hooks/useFinanceSubmit';
describe('useFinanceSubmit',()=>{
  it('guards two synchronous submits before React can disable the button',async()=>{
    let finish!:()=>void;const save=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;}));const close=vi.fn();
    const hook=renderHook(()=>useFinanceSubmit(save,close));
    let pending!:Promise<void>;
    await act(async()=>{pending=hook.result.current('100000');await hook.result.current('100000');});
    expect(save).toHaveBeenCalledOnce();expect(close).not.toHaveBeenCalled();
    await act(async()=>{finish();await pending;});expect(close).toHaveBeenCalledOnce();
  });
  it('preserves the draft on failure and permits one explicit corrected retry',async()=>{
    const save=vi.fn().mockRejectedValueOnce(new Error('Conflict')).mockResolvedValueOnce(undefined);const close=vi.fn();const saved=vi.fn();
    const hook=renderHook(()=>useFinanceSubmit(save,close,saved));
    await act(()=>hook.result.current('200000'));expect(close).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();
    await act(()=>hook.result.current('20000'));expect(save).toHaveBeenLastCalledWith('20000');expect(close).toHaveBeenCalledOnce();expect(saved).toHaveBeenCalledOnce();
  });
  it('closes a confirmed write even if an optional post-save callback fails',async()=>{
    const save=vi.fn().mockResolvedValue(undefined);const close=vi.fn();
    const hook=renderHook(()=>useFinanceSubmit(save,close,()=>{throw new Error('Callback failed');}));
    await act(()=>hook.result.current('20000'));expect(close).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledOnce();
  });
});
