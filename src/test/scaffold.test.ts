// src/test/scaffold.test.ts
const { executeToolCall } = require('../tools/exec');
const { execFile } = require('child_process');
const fs = require('fs-extra');

jest.mock('child_process', () => ({
  execFile: jest.fn((file, args, options, callback) => {
    setImmediate(() => callback(null, `Mocked run: ${file} ${args.join(' ')}`, ''));
    return { pid: 123 };
  }),
}));

jest.mock('fs-extra', () => {
  const original = jest.requireActual('fs-extra');
  return {
    ...original,
    ensureDir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  };
});

const execFileMock = execFile as unknown as jest.Mock;
const fsMock = fs as unknown as any;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Project Scaffolding (create_project)', () => {
  it('should scaffold React Vite projects', async () => {
    await executeToolCall('create_project', {
      template: 'react',
      projectName: 'my-react-app',
      outputDir: 'projects',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('npm');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      'create',
      'vite@latest',
      'my-react-app',
      '--',
      '--template',
      'react',
    ]);
  });

  it('should scaffold Next.js projects', async () => {
    await executeToolCall('create_project', {
      template: 'nextjs',
      projectName: 'my-next-app',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('npx');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      '-y',
      'create-next-app@latest',
      'my-next-app',
      '--use-npm',
      '--typescript',
      '--eslint',
      '--src-dir',
      '--app',
      '--import-alias',
      '@/*',
      '--tailwind',
    ]);
  });

  it('should scaffold Flutter projects with cleaned identifiers', async () => {
    await executeToolCall('create_project', {
      template: 'flutter',
      projectName: 'My-Awesome-App!',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('flutter');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      'create',
      '--project-name',
      'my_awesome_app_',
      'My-Awesome-App!',
    ]);
  });

  it('should scaffold .NET console and web API projects', async () => {
    await executeToolCall('create_project', {
      template: 'dotnet-console',
      projectName: 'ConsoleApp',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('dotnet');
    expect(execFileMock.mock.calls[0][1]).toEqual([
      'new',
      'console',
      '-n',
      'ConsoleApp',
      '-o',
      'ConsoleApp',
    ]);
  });

  it('should scaffold Flask projects writing files directly', async () => {
    const result = await executeToolCall('create_project', {
      template: 'flask',
      projectName: 'my-flask-server',
    });
    expect(fsMock.ensureDir).toHaveBeenCalled();
    expect(fsMock.writeFile).toHaveBeenCalledTimes(2);
    expect(result).toContain('Flask project "my-flask-server" successfully scaffolded');
  });

  it('should scaffold Django projects', async () => {
    await executeToolCall('create_project', {
      template: 'django',
      projectName: 'my_django_project',
    });
    expect(execFileMock).toHaveBeenCalledTimes(1);
    expect(execFileMock.mock.calls[0][0]).toBe('django-admin');
    expect(execFileMock.mock.calls[0][1]).toEqual(['startproject', 'my_django_project']);
  });
});
