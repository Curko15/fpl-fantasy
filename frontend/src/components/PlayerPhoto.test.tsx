// @vitest-environment happy-dom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player } from '../api'
import { PlayerPhoto } from './PlayerPhoto'

const player: Player = { id: 1, name: 'Saka', team: 'ARS', position: 'MID', photo_code: 223340, team_code: 3 }

describe('PlayerPhoto', () => {
  it('falls back from photo to club shirt to initial', () => {
    const { container } = render(<PlayerPhoto player={player} />)
    const img = () => container.querySelector('img')

    expect(img()?.getAttribute('src')).toContain('/223340.png')
    fireEvent.error(img()!)
    expect(img()?.getAttribute('src')).toContain('shirt_3-66.png')
    fireEvent.error(img()!)
    expect(img()).toBeNull()
    expect(container.textContent).toBe('S')
  })

  it('uses the goalkeeper shirt when there is no photo code', () => {
    const { container } = render(<PlayerPhoto player={{ ...player, position: 'GKP', photo_code: null }} />)
    expect(container.querySelector('img')?.getAttribute('src')).toContain('shirt_3_1-66.png')
  })
})
