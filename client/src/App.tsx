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
import { EchoesPage } from "@/pages/EchoesPage";
import { EchoDetailPage } from "@/pages/EchoDetailPage";
import { EchoSetsPage } from "@/pages/EchoSetsPage";
import { EchoSetDetailPage } from "@/pages/EchoSetDetailPage";
import { BangboosPage } from "@/pages/BangboosPage";
import { CznCardsPage } from "@/pages/CznCardsPage";
import { CznDecksPage } from "@/pages/CznDecksPage";
import { PLUGINS } from "@/lib/plugins";
import { VersionsPage } from "@/pages/VersionsPage";
import { BannersPage } from "@/pages/BannersPage";
import { PlannerPage } from "@/pages/PlannerPage";
import { BangbooDetailPage } from "@/pages/BangbooDetailPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { UpdatesPage } from "@/pages/UpdatesPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/updates" element={<UpdatesPage />} />
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
          <Route path="/:game/echoes" element={<EchoesPage />} />
          <Route path="/:game/echoes/:name" element={<EchoDetailPage />} />
          <Route path="/:game/echosets" element={<EchoSetsPage />} />
          <Route path="/:game/echosets/:name" element={<EchoSetDetailPage />} />
          <Route path="/:game/versions" element={<VersionsPage />} />
          <Route path="/:game/banners" element={<BannersPage />} />
          <Route path="/:game/planner" element={<PlannerPage />} />
          <Route path="/:game/bangboos" element={<BangboosPage />} />
          <Route path="/:game/cards" element={<CznCardsPage />} />
          <Route path="/:game/decks" element={<CznDecksPage />} />
          <Route path="/:game/bangboos/:name" element={<BangbooDetailPage />} />
          {PLUGINS.flatMap((p) => p.routes ?? []).map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
