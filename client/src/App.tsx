import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { HomePage } from "@/pages/HomePage";
import { CharactersPage } from "@/pages/CharactersPage";
import { CharacterDetailPage } from "@/pages/CharacterDetailPage";
import { WeaponsPage } from "@/pages/WeaponsPage";
import { WeaponDetailPage } from "@/pages/WeaponDetailPage";
import { ArtifactsPage } from "@/pages/ArtifactsPage";
import { ArtifactDetailPage } from "@/pages/ArtifactDetailPage";
import { MaterialsPage } from "@/pages/MaterialsPage";
import { MaterialDetailPage } from "@/pages/MaterialDetailPage";
import { LightConesPage } from "@/pages/LightConesPage";
import { LightConeDetailPage } from "@/pages/LightConeDetailPage";
import { RelicsPage } from "@/pages/RelicsPage";
import { RelicDetailPage } from "@/pages/RelicDetailPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/:game/characters" element={<CharactersPage />} />
          <Route path="/:game/characters/:name" element={<CharacterDetailPage />} />
          <Route path="/:game/weapons" element={<WeaponsPage />} />
          <Route path="/:game/weapons/:name" element={<WeaponDetailPage />} />
          <Route path="/:game/artifacts" element={<ArtifactsPage />} />
          <Route path="/:game/artifacts/:name" element={<ArtifactDetailPage />} />
          <Route path="/:game/materials" element={<MaterialsPage />} />
          <Route path="/:game/materials/:name" element={<MaterialDetailPage />} />
          <Route path="/:game/lightcones" element={<LightConesPage />} />
          <Route path="/:game/lightcones/:name" element={<LightConeDetailPage />} />
          <Route path="/:game/relics" element={<RelicsPage />} />
          <Route path="/:game/relics/:name" element={<RelicDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
