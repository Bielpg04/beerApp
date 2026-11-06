import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar, Button, Input, Sheet, Text, initials } from '@/shared/ui';

describe('Button', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    await render(<Button title="Salut" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Salut' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button title="Salut" onPress={onPress} disabled />);
    await fireEvent.press(screen.getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the title while loading', async () => {
    await render(<Button title="Salut" loading />);
    expect(screen.queryByText('Salut')).toBeNull();
    expect(screen.getByRole('button')).toBeBusy();
  });
});

describe('Input', () => {
  it('renders label and error message', async () => {
    await render(<Input label="Usuari" error="Ja existeix" />);
    expect(screen.getByText('Usuari')).toBeOnTheScreen();
    expect(screen.getByRole('alert')).toHaveTextContent('Ja existeix');
  });
});

describe('Avatar', () => {
  it.each([
    ['Biel', 'B'],
    ['Biel Palomar', 'BP'],
    ['  anna maria  garcia ', 'AG'],
    ['', '?'],
  ])('initials(%j) = %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('falls back to initials without image', async () => {
    await render(<Avatar name="Biel Palomar" />);
    expect(screen.getByText('BP')).toBeOnTheScreen();
  });
});

describe('Sheet', () => {
  it('renders content when visible and closes from the backdrop', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet visible title="Cerveses del bar" onClose={onClose}>
        <Text>Moritz</Text>
      </Sheet>,
    );
    expect(screen.getByText('Cerveses del bar')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
