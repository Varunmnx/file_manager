import { Flex } from "@mantine/core";
import { useRef, useState, useEffect } from "react";

interface Props {
    isMinimized: boolean;
    setIsMinimized: (isMinimized: boolean) => void;
    children?: React.ReactNode;
    width?: string;
}

const DraggableBox = ({isMinimized, setIsMinimized, children, width}:Props) => {
  const [position, setPosition] = useState({
    x: 20,
    y: window.innerHeight - 420,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const widgetRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".no-drag")) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <Flex
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 10px 40px rgba(0, 0, 0, 0.25)",
        width: width ?? "320px",
        maxHeight: isMinimized ? "auto" : "400px",
        zIndex: 1000,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Flex>
  );
};

export default DraggableBox;