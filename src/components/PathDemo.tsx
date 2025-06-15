
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const PathDemo = ({
  speak,
  onSimulateObstacle,
}: {
  speak: (t: string) => void;
  onSimulateObstacle: (type: string) => void;
}) => {
  const scenarios = [
    { name: "Stairs Ahead", desc: "Simulates stairs detected", type: "stairs" },
    { name: "Doorway", desc: "Simulates a doorway", type: "door" },
    { name: "Pole Ahead", desc: "Simulates obstacle pole", type: "pole" },
    { name: "Clear Path", desc: "Simulates walkable path", type: "path" },
  ];
  return (
    <Card className="p-4 bg-gray-800 border-gray-600 mt-2 text-white">
      <div className="font-bold mb-2">Simulate Environment Scenarios:</div>
      <div className="flex flex-wrap gap-2">
        {scenarios.map(s => (
          <Button
            key={s.type}
            className="bg-blue-900 text-white"
            onClick={() => {
              speak(`${s.name} detected. ${s.desc}`);
              onSimulateObstacle(s.type);
            }}
          >
            {s.name}
          </Button>
        ))}
      </div>
      <div className="text-sm text-gray-300 mt-2">Use these buttons to test voice output and feedback as if obstacles were detected in the environment.</div>
    </Card>
  );
};
