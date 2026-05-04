import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface Step {
  id: string;
  targetId: string;
  text: string;
  position: 'top' | 'bottom' | 'center';
  path?: string; // The path where this step is located
}

export const STEPS: Step[] = [
  // INTRO
  {
    id: 'welcome',
    targetId: 'tutorial-welcome',
    text: 'Bem-vindo ao FeedBECK! Este é o seu espaço para compartilhar e descobrir relatos de experiências únicas.',
    position: 'bottom',
    path: '/'
  },
  {
    id: 'post-overview',
    targetId: 'tutorial-post-card',
    text: 'Cada relato é um cartão como este, contendo todos os detalhes de um feedbeck',
    position: 'bottom',
    path: '/'
  },
  // FEED PAGE - POST DETAILS
  {
    id: 'author',
    targetId: 'tutorial-post-author',
    text: 'Este é quem escreveu o feedbeck. O nome e a @tag identificam o autor.',
    position: 'bottom',
    path: '/'
  },
  {
    id: 'category',
    targetId: 'tutorial-post-category',
    text: 'Aqui fica a categoria do post: Larica, Filme, Brisas ou Sons.',
    position: 'bottom',
    path: '/'
  },
  {
    id: 'title',
    targetId: 'tutorial-post-title',
    text: 'Este é o título do post!.',
    position: 'bottom',
    path: '/'
  },
  {
    id: 'content',
    targetId: 'tutorial-post-content',
    text: 'Aqui fica o conteúdo: os detalhes da experiência e as imagens.',
    position: 'bottom',
    path: '/'
  },
  {
    id: 'like',
    targetId: 'tutorial-post-like-button',
    text: 'Sintonizar: Se você curtiu o feedbeck, dê um toque no coração!',
    position: 'top',
    path: '/'
  },
  {
    id: 'comment',
    targetId: 'tutorial-post-comment-button',
    text: 'Comente para trocar ideia sobre o relato.',
    position: 'top',
    path: '/'
  },
  {
    id: 'save',
    targetId: 'tutorial-post-save-button',
    text: 'Salve o feedbeck para ver outras vezes em outro momento! O post fica salvo no seu perfil ao lado dos seus relatos. ',
    position: 'top',
    path: '/'
  },
  {
    id: 'share',
    targetId: 'tutorial-post-share-button',
    text: 'Se acha que seus amigos irão goster deste post, experimenta encaminhar este post para eles.',
    position: 'top',
    path: '/'
  },
  {
    id: 'report',
    targetId: 'tutorial-post-report-button',
    text: 'Denunciar: Caso veja algo que viole as regras, use a bandeirinha para nos avisar. Nossa moderação irá analisar.',
    position: 'top',
    path: '/'
  },
  {
    id: 'stars',
    targetId: 'tutorial-post-stars',
    text: 'Avaliação: Veja quantas estrelas o autor deu para essa experiência.',
    position: 'top',
    path: '/'
  },
  // NAVIGATION & PAGES
  {
    id: 'nav-search',
    targetId: 'nav-search',
    text: 'Área de Busca: Procure por novas sintonias.',
    position: 'top',
    path: '/'
  },
  {
    id: 'search-input',
    targetId: 'tutorial-search-input',
    text: 'Busque por @tag ou o nome de outros perfis.',
    position: 'bottom',
    path: '/search'
  },
  {
    id: 'nav-post',
    targetId: 'nav-post',
    text: 'Área de Post: Aqui é onde você compartilha as suas experiências!',
    position: 'top',
    path: '/'
  },
  {
    id: 'post-form',
    targetId: 'tutorial-post-form',
    text: 'Preencha tudo e conte sua história!',
    position: 'top',
    path: '/post'
  },
  {
    id: 'nav-profile',
    targetId: 'nav-profile',
    text: 'Perfil: O seu espaço pessoal no FeedBECK.',
    position: 'top',
    path: '/'
  },
  {
    id: 'profile-avatar',
    targetId: 'tutorial-profile-avatar',
    text: 'Sua identidade visual no FeedBECK. Você pode mudar seu estilo a qualquer momento!',
    position: 'bottom',
    path: '/profile'
  },
  {
    id: 'profile-stats',
    targetId: 'tutorial-profile-stats',
    text: 'Acompanhe seu progresso: seus relatos, sintonias e sua vibe dominante.',
    position: 'bottom',
    path: '/profile'
  },
  {
    id: 'profile-red-eyes',
    targetId: 'tutorial-profile-red-eyes',
    text: 'Olhinhos Vermelhos: Um contador manual de sessões. Toque à esquerda para diminuir e à direita para aumentar!',
    position: 'bottom',
    path: '/profile'
  },
  {
    id: 'profile-posts',
    targetId: 'tutorial-profile-posts',
    text: 'Seus relatos e posts salvos ficam guardados aqui.',
    position: 'top',
    path: '/profile'
  }
];

interface TutorialContextType {
  currentStep: number;
  isActive: boolean;
  nextStep: () => void;
  prevStep: () => void;
  completeTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { profile, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Activate tutorial if profile exists and not completed
    if (profile && !profile.tutorial_completed) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }, [profile]);

  useEffect(() => {
    // If the step change requires a path change, navigate
    const step = STEPS[currentStep];
    if (isActive && step.path && location.pathname !== step.path) {
      // Small delay to ensure the component is logic-ready
      const timer = setTimeout(() => {
        navigate(step.path!);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep, isActive, navigate, location.pathname]);

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTutorial();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeTutorial = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        tutorial_completed: true
      });
      setIsActive(false);
    } catch (err) {
      console.error('Error completing tutorial:', err);
      // Fallback: hide locally
      setIsActive(false);
    }
  };

  return (
    <TutorialContext.Provider value={{ currentStep, isActive, nextStep, prevStep, completeTutorial }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
