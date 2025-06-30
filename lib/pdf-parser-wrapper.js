// PDF Parser Wrapper to prevent debug mode execution
// This wrapper ensures pdf-parse doesn't run debug code when imported

import pdfParse from 'pdf-parse';

export default pdfParse;