import React from 'react';
import { controlSizes } from '../tokens';
import { BaseField, type FieldProps } from './Input';

export interface TextareaProps extends FieldProps {
  /** Altezza minima in righe indicative; il campo cresce col testo. */
  minHeight?: number;
}

export function Textarea({ minHeight = controlSizes.textareaMinHeight, ...props }: TextareaProps) {
  return <BaseField {...props} multiline minHeight={minHeight} />;
}
