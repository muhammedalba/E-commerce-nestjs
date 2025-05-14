import { Request } from 'express';

export type MulterFileType = Request['file'] | undefined;
export type MulterFilesType = Request['files'] | undefined;
