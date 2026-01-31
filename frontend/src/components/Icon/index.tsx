import { FileTypeIconMapKeys } from "@/utils/fileTypeIcons";
import { useEffect, useMemo } from "react";

const ICON_BASE_URL_V2 = "https://res.cdn.office.net/files/fabric-cdn-prod_20260113.001/assets/item-types/"
// const ICON_BASE_URL = "https://res.cdn.office.net/files/fabric-cdn-prod_20251010.003/assets/item-types/"
const iconSizes: number[] = [16, 20, 24, 32, 40, 48, 64, 96];
const scaleFactors = ["_1.5x","_2x","_3x","_4x"];

interface Props {
    iconSize: 16 | 20 | 24 | 32 | 40 | 48 | 64 | 96,
    scaleFactor: "_1.5x" | "_2x" | "_3x" | "_4x",
    extension:  FileTypeIconMapKeys,
    className?: string,
    style?: React.CSSProperties
}

const Icon = ({iconSize, scaleFactor, extension, className, style}: Props) => {
    
  const imageUrl = useMemo(() => {
    if(!iconSize || !scaleFactor || !extension) return "";
    //validations 
    if(!iconSizes.includes(iconSize)) return "";
    if (!scaleFactors.includes(scaleFactor)) return "";
    return `${ICON_BASE_URL_V2}/${iconSize}${scaleFactor}/${extension}.svg`;
  },[iconSize,scaleFactor,extension])

  useEffect(() => {
      if(!iconSize || !scaleFactor || !extension) return;
      //validations
      if(!iconSizes.includes(iconSize)) throw new Error("Invalid icon size");
      if (!scaleFactors.includes(scaleFactor)) throw new Error("Invalid scale factor");

  },[iconSize,scaleFactor,extension])
  return (
    <img 
      data-type="file-icon" 
      src={imageUrl} 
      alt="icon" 
      className={className}
      style={{ width: iconSize, height: iconSize, ...style }}
    />
  )
}

export default Icon