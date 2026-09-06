import { describe, expect, it } from 'vitest';
import {
  findLumixManagedJvmArgument,
  isLumixManagedJvmArgument,
  normalizeJvmArguments,
} from '../src/shared/jvm-args';

describe('jvm-args', () => {
  it('keeps one argument per line, including arguments containing spaces', () => {
    expect(normalizeJvmArguments(['  -Dmessage=hello world  ', '', ' -XX:+UseG1GC ']))
      .toEqual(['-Dmessage=hello world', '-XX:+UseG1GC']);
  });

  it('recognizes every JVM argument owned by Lumix', () => {
    for (const argument of ['-Xms2048M', '-Xmx4096M', '-jar', 'nogui', '--nogui', '@user_args.txt']) {
      expect(isLumixManagedJvmArgument(argument)).toBe(true);
    }
    expect(isLumixManagedJvmArgument('-Dfoo=bar')).toBe(false);
    expect(findLumixManagedJvmArgument(['-Dfoo=bar', '@args.txt'])).toBe('@args.txt');
  });
});
