import { describe, it, expect } from 'vitest';
import { parseVoiceCommand } from '../voiceCommands';

describe('parseVoiceCommand', () => {
  it('returns null for non-command speech', () => {
    expect(parseVoiceCommand('patient has a headache')).toBeNull();
    expect(parseVoiceCommand('the blood pressure is 120 over 80')).toBeNull();
  });

  it('returns null for partial wake word', () => {
    expect(parseVoiceCommand('hey open case')).toBeNull();
    expect(parseVoiceCommand('shadow open case')).toBeNull();
  });

  it('parses create case', () => {
    expect(parseVoiceCommand('hey shadow create case John Doe')).toEqual({ action: 'create-case', args: 'John Doe' });
  });

  it('parses open case', () => {
    expect(parseVoiceCommand('hey shadow open case MC-001')).toEqual({ action: 'open-case', args: 'MC-001' });
  });

  it('parses delete case', () => {
    expect(parseVoiceCommand('Hey Shadow delete case Patient A')).toEqual({ action: 'delete-case', args: 'Patient A' });
  });

  it('parses show history', () => {
    expect(parseVoiceCommand('hey shadow show history')).toEqual({ action: 'show-history', args: '' });
  });

  it('parses open session N', () => {
    expect(parseVoiceCommand('hey shadow open session 3')).toEqual({ action: 'open-session', args: '3' });
  });

  it('parses last update', () => {
    expect(parseVoiceCommand('hey shadow last update')).toEqual({ action: 'last-update', args: '' });
  });

  it('parses new session', () => {
    expect(parseVoiceCommand('hey shadow new session')).toEqual({ action: 'new-session', args: '' });
  });

  it('parses go back', () => {
    expect(parseVoiceCommand('hey shadow go back')).toEqual({ action: 'go-back', args: '' });
  });

  it('parses list cases', () => {
    expect(parseVoiceCommand('hey shadow list cases')).toEqual({ action: 'list-cases', args: '' });
  });

  it('parses save', () => {
    expect(parseVoiceCommand('hey shadow save')).toEqual({ action: 'save', args: '' });
  });

  it('parses discard', () => {
    expect(parseVoiceCommand('hey shadow discard')).toEqual({ action: 'discard', args: '' });
  });

  it('parses confirm delete', () => {
    expect(parseVoiceCommand('hey shadow confirm delete')).toEqual({ action: 'confirm-delete', args: '' });
  });

  it('is case-insensitive', () => {
    expect(parseVoiceCommand('HEY SHADOW OPEN CASE test')).toEqual({ action: 'open-case', args: 'test' });
  });

  it('trims whitespace in args', () => {
    expect(parseVoiceCommand('hey shadow create case   Jane Smith   ')).toEqual({ action: 'create-case', args: 'Jane Smith' });
  });
});
