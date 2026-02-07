import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

interface SkillsCharactersProps {
  onCharacterSelect?: (skill: string) => void;
}

interface SkillData {
  name: string;
  skills: string[];
  direction: string;
}

interface CategoryWithSprites {
  category: SkillData;
  sprites: Record<string, string>;
}

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px;
  overflow-y: auto;
  background: #c0c0c0;
`;

const Section = styled.div`
  margin-bottom: 16px;
`;

const SectionHeader = styled.div`
  background: #800080;
  color: white;
  padding: 4px 8px;
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 8px;
`;

const SkillsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 8px;
`;

const SkillCard = styled.div<{ selected: boolean }>`
  background: ${(props) => props.selected ? '#000080' : '#ffffff'};
  color: ${(props) => props.selected ? 'white' : 'black'};
  border: 2px solid #808080;
  padding: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  &:hover {
    background: #c0c0c0;
  }
`;

const SkillIcon = styled.img`
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
`;

const SkillName = styled.div`
  font-size: 10px;
  text-align: center;
  word-wrap: break-word;
`;

const Loading = styled.div`
  padding: 20px;
  text-align: center;
  color: #800080;
`;

const Error = styled.div`
  padding: 20px;
  text-align: center;
  color: #ff0000;
`;

const SkillsCharacters: React.FC<SkillsCharactersProps> = ({ onCharacterSelect }) => {
  const [categories, setCategories] = useState<CategoryWithSprites[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    const fetchSkills = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/skills');
        const data = await response.json();

        if (data.success) {
          setCategories(
            data.data.categories.map((cat: SkillData) => ({
              category: cat,
              sprites: data.sprites || {}
            }))
          );
        } else {
          setError(data.error);
        }
      } catch {
        setError('Failed to load skills');
      } finally {
        setLoading(false);
      }
    };

    fetchSkills();
  }, []);

  const handleSkillClick = (skill: string) => {
    setSelectedSkill(skill);
    onCharacterSelect?.(skill);
  };

  if (loading) {
    return <Loading>Loading skills...</Loading>;
  }

  if (error) {
    return <Error>{error}</Error>;
  }

  return (
    <Container>
      {categories.map((item) => (
        <Section key={item.category.name}>
          <SectionHeader>{item.category.name}</SectionHeader>
          <SkillsGrid>
            {item.category.skills.map((skill) => (
              <SkillCard
                key={skill}
                selected={selectedSkill === skill}
                onClick={() => handleSkillClick(skill)}
                draggable
              >
                {item.sprites[skill] ? (
                  <SkillIcon src={item.sprites[skill]} alt={skill} />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      background: '#c0c0c0',
                      border: '1px solid #808080',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20
                    }}
                  >
                    ?
                  </div>
                )}
                <SkillName>{skill}</SkillName>
              </SkillCard>
            ))}
          </SkillsGrid>
        </Section>
      ))}
    </Container>
  );
};

export default SkillsCharacters;
