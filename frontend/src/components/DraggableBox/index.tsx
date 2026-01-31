import { Flex } from "@mantine/core";
import { useRef, useState, useEffect } from "react";

interface Props {
    isMinimized: boolean;
    setIsMinimized?: (isMinimized: boolean) => void;
    children?: React.ReactNode;
    width?: string;
}

const DraggableBox = ({isMinimized, children, width}:Props) => {
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

  useEffect(() => {
    if (isMinimized) {
      setPosition({
        x: window.innerWidth - 520,
        y: window.innerHeight - 80,
      });
    } else {
      setPosition({
        x: window.innerWidth - 520,
        y: window.innerHeight - 260,
      });
    }
  }, [isMinimized]);

  return (
    <Flex
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      className={`fixed bg-white rounded-xl shadow-2xl z-[1000] flex flex-col select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${!isMinimized ? 'max-h-[400px]' : ''}`}
      style={{
        left: position.x,
        top: position.y,
        width: width ?? "320px",
      }}
    >
      {children}
    </Flex>
  );
};

export default DraggableBox;