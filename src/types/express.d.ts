declare namespace Express {
  export interface Multer {
    file: any;
  }

  export interface Request {
    files?: Multer.File[];
  }
}
